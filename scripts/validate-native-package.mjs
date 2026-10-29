import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const results = path.join(root, 'validation-results');
await mkdir(results, { recursive: true });
const input = path.join(root, 'validation-assets/input.json');
const extension = process.platform === 'win32' ? '.exe' : '';
const compiled = path.join(root, `src-tauri/target/release/open-video-downloader${extension}`);
const checks = [];
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: 300000, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
async function smoke(executable, mode, label) {
  const report = path.join(results, `${label}.json`);
  const check = { label, mode, executable, report, status: 'running', guiExercised: false };
  checks.push(check);
  try {
    run(executable, ['--validate-dependencies', input, path.join(root, `validation-work/${label} ü`), report, mode]);
    check.status = 'passed';
  } catch (error) {
    check.status = 'failed';
    check.error = String(error);
    throw error;
  }
}
async function find(directory, predicate) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && predicate(file)) return file;
    if (entry.isDirectory()) {
      const nested = await find(file, predicate);
      if (nested) return nested;
    }
  }
  return null;
}
try {
  await smoke(compiled, 'installed', 'compiled-app');
  const portable = path.join(root, 'portable-layout');
  await mkdir(path.join(portable, 'ovd-portable'), { recursive: true });
  await mkdir(path.join(portable, 'licenses'), { recursive: true });
  await writeFile(path.join(portable, 'ovd-portable/.keep'), 'Keep this directory for portable storage.\n');
  const portableExe = path.join(portable, `open-video-downloader${extension}`);
  await cp(compiled, portableExe);
  await cp(path.join(root, 'licenses/3rdpartylicenses.txt'), path.join(portable, 'licenses/3rdpartylicenses.txt'));
  await smoke(portableExe, 'portable', 'portable-layout');
  const bundle = path.join(root, 'src-tauri/target/release/bundle');
  let packaged;
  let method;
  if (process.platform === 'win32') {
    const setup = await find(bundle, file => file.endsWith('-setup.exe'));
    if (!setup) throw new Error('NSIS installer missing');
    const installed = path.join(process.env.RUNNER_TEMP, 'ovd-installed');
    run(setup, ['/S', `/D=${installed}`]);
    packaged = await find(installed, file => path.basename(file).toLowerCase() === 'open-video-downloader.exe');
    method = 'NSIS silent installation';
  } else if (process.platform === 'darwin') {
    packaged = await find(bundle, file => file.endsWith('.app/Contents/MacOS/open-video-downloader'));
    method = 'built .app executable';
  } else {
    const deb = await find(bundle, file => file.endsWith('.deb'));
    if (!deb) throw new Error('Debian package missing');
    const architecture = spawnSync('dpkg-deb', ['--field', deb, 'Architecture'], { encoding: 'utf8' });
    const expected = process.arch === 'arm64' ? 'arm64' : 'amd64';
    if (architecture.status !== 0 || architecture.stdout.trim() !== expected) throw new Error('Debian package architecture mismatch');
    const extracted = path.join(root, 'validation-work/deb-extracted');
    run('dpkg-deb', ['--extract', deb, extracted]);
    packaged = await find(extracted, file => path.basename(file) === 'open-video-downloader');
    method = 'Debian package extraction (not OS package registration)';
  }
  if (!packaged) throw new Error('Packaged application executable missing');
  const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
  // macOS ad-hoc signing changes the executable; validate its execution directly.
  if (process.platform !== 'darwin' && await digest(packaged) !== await digest(compiled)) throw new Error('Packaged executable differs from compiled application');
  await smoke(packaged, 'installed', 'packaged-app');
  checks.at(-1).packagingMethod = method;
} finally {
  await writeFile(path.join(results, 'packaging.json'), JSON.stringify({ checks, guiExercised: false }, null, 2));
}
