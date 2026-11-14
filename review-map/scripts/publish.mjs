#!/usr/bin/env node
// Publishes the reviewer into a branch of the target repository through the GitHub API (no git push):
//   review-map/<files>            -> .review-map/<files>
//   review-map/workflows/*.yml    -> .github/workflows/*.yml
// Usage: node scripts/publish.mjs <owner/repo> <branch>

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [slug, branch] = process.argv.slice(2);
if (!slug || !branch) throw new Error('usage: node scripts/publish.mjs <owner/repo> <branch>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  'README.md', 'package.json', 'package-lock.json', 'review.mjs', 'render.mjs',
  'lib/claude.mjs', 'lib/context.mjs', 'lib/evidence.mjs', 'lib/schemas.mjs', 'lib/verify.mjs', 'lib/checks.mjs', 'lib/finish.mjs',
  'scripts/finish.mjs', 'test/gate.test.mjs', 'test/fixtures/agent-output-2234.json',
  // The recorded evidence of the hand-written 2283 review, so its replay commands work from the fork.
  ...['context', 'scenarios', 'probe-before', 'probe-after', 'probe-mutant', 'probe-without-H1', 'probe-without-H2', 'probe-without-H3', 'probe-without-H1+H2+H4', 'tests'].map((f) => `evidence/2283/${f}.json`),
  'adapters/messagepack/adapter.mjs', 'adapters/messagepack/handoffs.mjs', 'adapters/messagepack/pipeline.md',
  'adapters/messagepack/example-scenarios.json', 'adapters/messagepack/ReviewMapProbe.cs',
].map((f) => ({ from: f, to: `.review-map/${f}` }));
files.push({ from: 'workflows/review-map.yml', to: '.github/workflows/review-map.yml' });

// Each call is retried with backoff: one dropped connection should not fail the whole publish.
// Nothing changes on GitHub until the final ref update, so a failed publish leaves the branch as it was.
const api = (method, path, body) => {
  let last;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = spawnSync('gh', ['api', '-X', method, path, ...(body ? ['--input', '-'] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) return JSON.parse(r.stdout);
    last = r.stderr || r.stdout;
    if (/HTTP 4(0[1-4]|22)/.test(last) && !/malformed request/.test(last)) break;
    spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${2000 * attempt})`]);
  }
  throw new Error(`${method} ${path}: ${last}`);
};

// Git's blob id, so files already on the branch with the same content are not uploaded again.
const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const ref = api('GET', `repos/${slug}/git/ref/heads/${branch}`);
const parent = api('GET', `repos/${slug}/git/commits/${ref.object.sha}`);
const existing = new Map(api('GET', `repos/${slug}/git/trees/${parent.tree.sha}?recursive=1`).tree.map((e) => [e.path, e.sha]));
let uploaded = 0;
const tree = files.map((f) => {
  const buf = readFileSync(join(root, f.from));
  const sha = blobSha(buf);
  if (existing.get(f.to) === sha) return { path: f.to, mode: '100644', type: 'blob', sha };
  uploaded++;
  const blob = api('POST', `repos/${slug}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
  return { path: f.to, mode: '100644', type: 'blob', sha: blob.sha };
});
const newTree = api('POST', `repos/${slug}/git/trees`, { base_tree: parent.tree.sha, tree });
if (newTree.sha === parent.tree.sha) {
  console.log(`${branch} already up to date at ${ref.object.sha.slice(0, 8)}`);
  process.exit(0);
}
const commit = api('POST', `repos/${slug}/git/commits`, {
  message: 'Add review-map reviewer and workflow\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',
  tree: newTree.sha,
  parents: [ref.object.sha],
});
api('PATCH', `repos/${slug}/git/refs/heads/${branch}`, { sha: commit.sha });
console.log(`${branch}: ${ref.object.sha.slice(0, 8)} -> ${commit.sha.slice(0, 8)} (${files.length} files, ${uploaded} uploaded)`);
