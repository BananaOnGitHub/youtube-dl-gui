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

Linux ARM64 has no managed AtomicParsley asset in the currently signed manifest;
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
