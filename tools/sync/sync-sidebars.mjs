#!/usr/bin/env node
/**
 * Regenerate the sidebar of every mirrored version from the official site.
 *
 * Each RouterOS version has its own sidebar tree, so deriving an old version's
 * sidebar by pruning the current one is only an approximation. This wrapper
 * crawls every version (current + the ones listed in versions.json), then builds
 * the matching sidebar file:
 *
 *   current  -> sidebars.ts (with the local `compare-versions` page)
 *   <old>    -> versioned_sidebars/version-<old>-sidebars.json
 *
 *   node tools/sync/sync-sidebars.mjs              # crawl + build everything
 *   node tools/sync/sync-sidebars.mjs --no-crawl   # rebuild from existing manifests
 *   node tools/sync/sync-sidebars.mjs --version 7.24
 */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};

const current = JSON.parse(fs.readFileSync('data/manifests/current-version.json', 'utf8')).version;
const versions = fs.existsSync('versions.json')
  ? JSON.parse(fs.readFileSync('versions.json', 'utf8'))
  : [];
const selected = value('--version', null);
const targets = selected ? [selected] : [current, ...versions];

function run(script, argv) {
  process.stdout.write(`\n$ node ${script} ${argv.join(' ')}\n`);
  const result = spawnSync(process.execPath, [script, ...argv], {stdio: 'inherit'});
  if (result.status !== 0) {
    throw new Error(`${script} failed with ${result.status}`);
  }
}

for (const version of targets) {
  const docsDir = version === current ? 'docs' : path.join('versioned_docs', `version-${version}`);
  const sidebarFile = path.join('data/manifests', `docs-${version}-sidebar.json`);

  if (!fs.existsSync(docsDir)) {
    process.stderr.write(`skip ${version}: ${docsDir} does not exist\n`);
    continue;
  }
  if (!has('--no-crawl')) {
    // Static crawl of the rendered sidebar: it visits documents instead of
    // category URLs, so an official category page that 404s can no longer drop
    // a whole subtree, and it also records the official previous/next edges.
    run('tools/sync/crawl-nav.mjs', [`--version=${version}`]);
  }
  if (!fs.existsSync(sidebarFile)) {
    process.stderr.write(`skip ${version}: ${sidebarFile} missing (run without --no-crawl)\n`);
    continue;
  }
  const buildArgs = [
    '--version',
    version,
    '--sidebar',
    sidebarFile,
    '--docs',
    docsDir,
  ];
  // The compare page only exists in the current version.
  if (version === current) buildArgs.push('--compare');
  run('tools/sync/build-sidebars.mjs', buildArgs);
}

process.stdout.write('\nsidebars regenerated\n');
