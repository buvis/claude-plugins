// Fail if any version in marketplace.json drifts from the plugin's real
// upstream .claude-plugin/plugin.json. This is the safety net for the bug where
// a release once stamped one plugin's version onto every entry in the list.
//
// Run locally:  node scripts/validate-versions.mjs
// In CI:        .github/workflows/validate-versions.yml
//
// Zero dependencies: needs Node 18+ for global fetch.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');

// "https://github.com/buvis/claude-warden.git" + branch ->
// "https://raw.githubusercontent.com/buvis/claude-warden/<branch>/.claude-plugin/plugin.json"
function rawPluginUrl(repoUrl, branch) {
  const base = repoUrl.replace(/\.git$/, '').replace('github.com', 'raw.githubusercontent.com');
  return `${base}/${branch}/.claude-plugin/plugin.json`;
}

async function upstreamVersion(repoUrl) {
  for (const branch of ['master', 'main']) {
    const res = await fetch(rawPluginUrl(repoUrl, branch));
    if (res.ok) {
      const manifest = JSON.parse(await res.text());
      return manifest.version;
    }
    if (res.status !== 404) {
      throw new Error(`HTTP ${res.status} fetching ${rawPluginUrl(repoUrl, branch)}`);
    }
  }
  throw new Error(`plugin.json not found on master or main for ${repoUrl}`);
}

const marketplace = JSON.parse(await readFile(marketplacePath, 'utf-8'));
const mismatches = [];

for (const plugin of marketplace.plugins) {
  const repoUrl = plugin.source?.url;
  if (!repoUrl) {
    mismatches.push(`${plugin.name}: no source.url to verify against`);
    continue;
  }
  const upstream = await upstreamVersion(repoUrl);
  const status = upstream === plugin.version ? 'ok' : 'DRIFT';
  console.log(`${status.padEnd(5)} ${plugin.name.padEnd(16)} marketplace=${plugin.version} upstream=${upstream}`);
  if (upstream !== plugin.version) {
    mismatches.push(`${plugin.name}: marketplace ${plugin.version} != upstream ${upstream}`);
  }
}

if (mismatches.length > 0) {
  console.error(`\nVersion drift detected:\n  ${mismatches.join('\n  ')}`);
  process.exit(1);
}

console.log('\nAll marketplace versions match upstream plugin.json.');
