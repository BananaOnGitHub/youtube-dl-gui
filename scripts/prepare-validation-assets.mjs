import { createHash, createPublicKey, verify } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.argv[2] ?? 'validation-assets');
const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
if (!os || !arch) throw new Error(`Unsupported native runner: ${process.platform}/${process.arch}`);
const platform = `${os}-${arch}`;
if (process.env.OVD_EXPECT_PLATFORM && platform !== process.env.OVD_EXPECT_PLATFORM) {
  throw new Error(`Expected native ${process.env.OVD_EXPECT_PLATFORM}, Node is ${platform}`);
}
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
await mkdir(output, { recursive: true });
const base = 'https://jely2002.github.io/youtube-dl-gui/manifest';
const bytes = await get(`${base}/manifest.json`);
const signature = Buffer.from((await get(`${base}/manifest.sig`)).toString().trim(), 'base64');
const key = createPublicKey({
  key: Buffer.from('302a300506032b6570032100ae7988a00d92349e55ff560369e7ec6afdb4b22a7e1dbe62a6769e1f347fa073', 'hex'),
  format: 'der', type: 'spki',
});
if (!verify(null, bytes, key, signature)) throw new Error('Manifest signature verification failed');
const manifest = JSON.parse(bytes);
const evidence = [];
for (const [tool, info] of Object.entries(manifest.tools)) {
  const selected = info.files[platform]
    ? platform
    : tool === 'AtomicParsley' && platform === 'darwin-aarch64' && info.files['darwin-x86_64'] ? 'darwin-x86_64' : null;
  if (!selected) {
    evidence.push({ tool, status: 'no managed asset', platform });
    continue;
  }
  const asset = info.files[selected];
  const filename = path.basename(new URL(asset.url).pathname);
  const directory = path.join(output, tool);
  await mkdir(directory, { recursive: true });
  const file = await get(asset.url);
  const digest = createHash('sha256').update(file).digest('hex');
  if (digest !== asset.sha256.toLowerCase()) throw new Error(`${tool}: signed manifest SHA256 mismatch at ${asset.url}`);
  await writeFile(path.join(directory, filename), file);
  evidence.push({ tool, selected, url: asset.url, sha256: digest, bytes: file.length });
  console.log(`${tool}: verified ${selected} asset (${file.length} bytes)`);
}
await writeFile(path.join(output, 'manifest.json'), bytes);
await writeFile(path.join(output, 'manifest.sig'), signature.toString('base64'));
await writeFile(path.join(output, 'input.json'), JSON.stringify({ platform, assetsRoot: output, tools: manifest.tools }, null, 2));
await writeFile(path.join(output, 'downloads.json'), JSON.stringify({ platform, signatureVerified: true, evidence }, null, 2));
console.log(`Native assets prepared for ${platform}`);
