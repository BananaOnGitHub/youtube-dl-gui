// One-time cleanup, constrained to the redundant branches created in this task.
const branches = {
  'build/portable-x64-8eb5a20': '53e0e3def83003c310dfd288d83a0adfc6b3289c',
  'build/portable-x64-43eb9ba': '7fefc9a8024c44bbc2bcc17618c54d5ec3e95a42',
  'build/portable-x64-392fa2a': 'c5b13b815e29c691fdbc5f6dc0bcbc20308b3b01',
  'build/portable-x64-418dc76': 'f48db85b57384e97e73bb4affc2ca8c9baa968fa',
  'build/portable-x64-361208a': '4ac6fea3f3a760662f26229870da8a71a6ba7cfc',
  'build/portable-x64-e62ff5c': 'a882b1dcd86de9e5268e960bf4938036f5b941f6',
};
if (process.env.GITHUB_REPOSITORY !== 'BananaOnGitHub/youtube-dl-gui'
  || process.env.GITHUB_REF !== 'refs/heads/feature/system-dependency-discovery'
  || process.env.GITHUB_EVENT_NAME !== 'push') throw new Error('Cleanup is restricted to this fork and feature push');
const api = 'https://api.github.com/repos/BananaOnGitHub/youtube-dl-gui';
async function request(endpoint, method = 'GET') {
  const response = await fetch(`${api}/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`GitHub ${method}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
for (const [branch, sha] of Object.entries(branches)) {
  const endpoint = `git/refs/heads/${branch}`;
  const ref = await request(endpoint);
  if (!ref) {
    console.log(`Already absent: ${branch}`);
    continue;
  }
  if (ref.object.sha !== sha) throw new Error(`Refusing changed branch: ${branch}`);
  const comparison = await request(`compare/${process.env.GITHUB_SHA}...${sha}`);
  if (!comparison || comparison.files.length !== 1
    || comparison.files[0].filename !== '.github/workflows/portable-test-build.yml') {
    throw new Error(`Refusing branch with other unique changes: ${branch}`);
  }
  await request(endpoint, 'DELETE');
  if (await request(endpoint)) throw new Error(`Branch still exists: ${branch}`);
  console.log(`Deleted redundant branch: ${branch} (${sha})`);
}
