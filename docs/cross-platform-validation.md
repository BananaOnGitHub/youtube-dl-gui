# Native dependency and application validation

The `Dependency resolver` workflow runs on pushes to
`feature/system-dependency-discovery`, on main, and on other PRs targeting main.
The feature branch's PR trigger is skipped to avoid duplicating its exact-head
push run. Documentation-only pushes do not restart the six native builds.
No validation job merges a PR, creates a release, or uses signing credentials.

## Evidence categories

- **Native fixtures:** production resolver/installer/extractor/runtime modules run
  with small generated test executables. These establish regression behavior,
  not compatibility with the real upstream tools or the entire GUI application.
- **Real native backend:** an Ed25519-verified upstream manifest and SHA256-checked
  downloads feed the production extraction, validation, publication, resolver,
  process-control, and runtime adapter code. PE/ELF/Mach-O architecture is recorded;
  permitted OS translation is reported separately from native execution.
- **Compiled application:** the full Tauri executable is built with the opt-in
  `dependency-validation` feature. Its headless entry point runs the same real
  backend scenarios, before GUI/plugin initialization. This is actual execution
  of the compiled application's dependency backend, not a GUI or IPC test.
- **Packaging/layout:** the compiled app is run with the actual portable marker,
  and from the native package. Windows uses an unsigned NSIS silent installation;
  macOS executes the generated `.app`; Linux extracts a native `.deb` and executes
  its binary (it does not register that package with the OS package manager).

Each platform's `validation-*` artifact contains signed manifest provenance,
asset selection, header architecture, detected versions and paths, successful
checks and any error. Never infer that all behavior passed from a compiled
binary, a dispatched workflow, or fixture success alone. Inspect job steps,
logs, and reports. GUI scenarios, updater behavior and system integration can
remain unverified even when these backend checks pass.

## Six native targets

| Runner | Rust target | Native package |
| --- | --- | --- |
| Windows x64 | x86_64-pc-windows-msvc | NSIS + portable files |
| Windows ARM64 | aarch64-pc-windows-msvc | NSIS + portable files |
| macOS Intel | x86_64-apple-darwin | app |
| macOS Apple Silicon | aarch64-apple-darwin | app |
| Linux x64 | x86_64-unknown-linux-gnu | deb |
| Linux ARM64 | aarch64-unknown-linux-gnu | deb |

Both Node and Rust assert that they are executing the requested native target.
The workflow uses Rust 1.94.1, matching application CI. CI application builds
turn off release LTO and debug information and use 16 codegen units; they are
unsigned validation builds, not byte-for-byte release-profile reproductions.

## Real-tool scenarios

1. Select the exact platform asset (only the existing documented macOS
   AtomicParsley Intel fallback is allowed when an ARM asset is absent).
2. Verify the manifest signature and each download hash; inspect binary headers.
3. Extract with production ZIP/tar functions, retain bundle runtime files,
   validate staged executable capabilities, and publish to managed storage.
4. Seed an isolated PATH with those real tools and exercise environment discovery.
5. Reject a real invalid executable and use managed fallback; reject an invalid
   explicit pin without silently falling back; check locked bundled resolution.
6. Put real FFmpeg and FFprobe in separate paths, use the runtime alias adapter,
   encode a short AAC source, download it through yt-dlp from a local HTTP server,
   convert it to MP3 and verify its codec with FFprobe. No public media website
   or account is needed.
7. Repeat through the full application in normal and portable storage layouts,
   then through its generated native package.

The current signed manifest maps an ARM-only AtomicParsley macOS archive to its
Intel key. Native Intel validation rejects that optional asset and explicitly
reports partial coverage; its hash is never replaced or bypassed. The required
four tools continue through all execution and packaging checks. Linux ARM64 also
has no managed AtomicParsley asset in the currently signed manifest;
that optional dependency is reported unavailable, not fabricated or silently
substituted. Windows ARM64 assets can contain Intel executables; such successful
execution is classified as OS translation, not native ARM validation. Apple
Silicon explicitly installs Rosetta for the documented optional fallback.

## Scope still requiring separate evidence

GUI rendering and interaction on ARM/macOS/Linux, frontend-to-Rust IPC and OS
keychain behavior are not exercised by the headless entry point. Signing,
notarization, SmartScreen/Gatekeeper trust, updater installation, MSIX/Store
registration, Snap, AppImage, RPM and DMG installation are not claimed by this
workflow. Existing path unit tests model bundled/MSIX/Snap storage rules, while
live checks exercise locked resolver behavior. These are not MSIX/Snap installs.

## Baseline audited before this expansion

At feature head `361208a`, native fixture jobs in Actions run `40958037462` all
passed: Windows x64/ARM64 33 tests each, Linux x64/ARM64 33 each, macOS Intel/ARM64
32 each. Logs were inspected. Linux full Rust CI (`40958037521`) and frontend CI
(`40958037411`) also passed. The user manually validated Windows x64 portable.
That baseline does **not** establish six-platform real-tool or GUI validation.

The expanded real-tool suite was executed successfully on local Linux x64 before
submission. Other current results must come from the new workflow's actual logs
and artifacts, not this baseline.

## Build branch consolidation

The feature branch owns building and validation. Windows portable artifacts
contain the executable, license file and portable marker directly, with no
nested ZIP. A cleanup job has repository write permission only for deleting the
six audited `build/portable-x64-*` branches. It checks their exact saved heads and
refuses any branch whose unique diff includes anything besides the obsolete
portable build workflow. The native validation job has read-only contents access.

## First expanded run and regression repairs

Actions run `40965503448` at `82eac11` was inspected job by job:

| Platform | Actual execution established | Remaining failure in that run |
| --- | --- | --- |
| Windows x64 | Real native harness and compiled application backend passed | Portable-layout HTTP fixture connection reset before completing conversion |
| Windows ARM64 | Real harness, compiled app and portable app backend passed | Packaged binary blocked by a raw-byte equality assertion |
| macOS Intel | The four required staged executables passed validation | Optional signed AtomicParsley asset is ARM-only; subsequent composite installer did not install cargo-about after the earlier failure |
| macOS ARM64 | Real harness, compiled app, portable marker layout and packaged app backend all passed | None in covered headless scenarios |
| Linux x64 | Real harness, compiled app and portable app backend passed | Packaged binary blocked by a raw-byte equality assertion |
| Linux ARM64 | Required-tool harness, compiled app and portable app backend passed | Packaged binary blocked by a raw-byte equality assertion; no optional AtomicParsley asset |

The repaired HTTP fixture drains complete, potentially fragmented request headers
before returning media and closing the connection. A permanent GET/HEAD fragmented
header test runs on all six native hosts. Package checks record both binary hashes,
then require the packaged executable itself to report the expected embedded commit,
application version and native platform and to complete its real backend checks.
They do not assume byte identity across packaging. Permanent identity tests reject
wrong commits, versions and platforms. Partial optional-tool results remain visibly
partial in JSON evidence and job summaries, even when required functionality passes.

Real-dependency step failures are collected without preventing the full build from
running. A final gate still fails the job if those required checks failed; this
avoids misleading downstream errors from composite actions skipping internal steps
after an earlier failure. No artifact or success signal substitutes for inspected
execution results. The next run is required before claiming these repairs passed
on the affected platforms.

## Second expanded run and remaining repairs

All six job logs and their downloaded JSON evidence from run `40969399782` at
`9db2509` were inspected. Every native fixture suite passed (34 tests on Windows
and Linux, 33 on macOS). Real-tool results were:

| Platform | Native backend | Full application and portable layout | Native package execution |
| --- | --- | --- | --- |
| Windows x64 | Passed | Both passed | NSIS installed app ran; conversion failed at the local HTTP fixture |
| Windows ARM64 | Passed; AtomicParsley uses x64 OS translation | Both passed | NSIS silent installation and backend checks passed |
| macOS Intel | Four required tools passed; optional ARM-only AtomicParsley correctly rejected | Build blocked before Rust compilation by missing cargo-about CLI | Not exercised |
| macOS Apple Silicon | All five tools passed natively | Both passed | Built .app backend checks passed |
| Linux x64 | All five tools passed natively | Both passed | Extracted amd64 .deb backend checks passed |
| Linux ARM64 | Four required tools passed natively; AtomicParsley unavailable | Both passed with partial optional coverage | Extracted arm64 .deb backend checks passed with partial optional coverage |

The Windows logs identified `WSAEWOULDBLOCK` (10035) on accepted sockets before
yt-dlp's connection abort (10053). The listener is deliberately nonblocking so
the server can stop, but accepted sockets inherit that mode on Windows. The
handler now explicitly restores blocking mode before applying bounded timeouts.
The permanent fragmented GET/HEAD regression explicitly starts with a nonblocking
stream on every host. It reproduced the failure on Linux before the fix, ensuring
this Windows behavior is covered without relying on an intermittent CI failure.

The Intel macOS cargo-about installer compiled v0.9.3 successfully but installed
no binary: that crate's CLI requires its `cli` feature and there was no matching
prebuilt binary selected by the fallback. Intel macOS now installs the pinned
version from source with `--locked --features cli`. Other native jobs use the
same pinned version through the existing checksum-verifying installer. Every
platform must execute `cargo about --version` and `cargo about generate --help`
before the full application build is allowed to proceed. A successful install
step alone is insufficient evidence that the license tool is usable.

These repairs require another native run. The successful headless checks above
remain evidence for `9db2509`; they do not establish GUI, IPC, signed release or
OS package-registration coverage, or a passing result for the next commit.

## Third expanded run and upstream download drift

All six job logs from run `40973895704` at `d5f3f76` were inspected:

| Platform | Evidence in this run | Outstanding coverage |
| --- | --- | --- |
| Windows x64 | Native fixtures, real harness, full application, portable layout and NSIS-installed app backend passed | GUI remains the user's earlier manual validation only |
| Windows ARM64 | Native fixtures and full native application/NSIS compilation passed | Real execution skipped after the signed FFmpeg download's checksum mismatch; prior run `40969399782` exercised it successfully |
| macOS Intel | License CLI repair worked; full native app compiled and .app packaged | HTTP fixture regression failed after delivering its response; real backend and package execution skipped |
| macOS Apple Silicon | Native fixtures, real harness, full application, portable layout and .app backend passed | GUI and notarized distribution unverified |
| Linux x64 | Native fixtures, real harness, full application, portable layout and extracted .deb backend passed | GUI and OS package registration unverified |
| Linux ARM64 | Same required-tool checks and extracted .deb execution passed | Optional AtomicParsley unavailable; GUI and OS package registration unverified |

The Intel Mac client received and checked the complete HTTP response, but the
server then returned `EINVAL` during socket cleanup. Shutdown and drain-timeout
configuration after a flushed response are now best effort: the peer may already
have closed. Request reads and response writes still propagate errors. The same
nonblocking/fragmented GET/HEAD regression remains enabled on every native host.

Windows ARM64's signed manifest referenced a mutable FFmpeg `/latest/` ZIP with
SHA256 `ba897be554258e2205353f12f10472c156658204b4e08a2805c6562d40fe0782`.
The archive was replaced upstream with SHA256
`1072fcb0d44ec6e960c998eb68899326eca6db5bef6957067f1e05ac8a6a0045`, so
rejection was correct. A subsequent signature-verified manifest fetch contained
that new checksum, and downloading the actual archive verified against it.
There is no checksum bypass, alternate trust key or compatibility-fixture
substitution. The native rerun must still exercise these freshly verified tools.

Future manifest generation in this branch selects a dated FFmpeg autobuild
release and derives both executable entries from that exact archive name instead
of a mutable `latest` URL. Regression coverage rejects latest-only metadata,
drafts, absent ARM assets and mismatched download URLs. This generator change
does not republish the externally hosted signed manifest: its maintainers must
adopt the fix for durable production protection against future download drift.
Strict download regression tests prove changed bytes remain rejected and expose
the expected and actual hashes in the error.

Asset preparation now saves the verified raw manifest/signature before downloads
and checkpoints download evidence even on failure. Windows portable files are
prepared independently of dependency diagnostics, with a regression checking the
executable, license and portable marker layout without requiring any downloaded
tools. Uploading the raw folder still produces one outer Actions ZIP.

Before this repair commit, local Linux checks passed: 34 resolver tests, seven
script regression tests, harness Clippy/formatting, 136 frontend unit tests,
frontend lint/build, and real signed-tool discovery and media conversion. The
source generator was also run against real GitHub release metadata and selected
the dated ARM64 archive; its downloaded PE headers identified both executables
as ARM64. Local full-app Rust checks lacked cached `ed25519-dalek`; local E2E
could not start without Chromium and dependency installation was blocked by the
container's setgroups/setegid restrictions. Those checks are not counted as
passing; native application results must come from the new Actions run.
