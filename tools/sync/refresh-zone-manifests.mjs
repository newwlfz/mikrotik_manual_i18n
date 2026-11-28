#!/usr/bin/env node
/**
 * Refresh the content hashes of the three zone manifests.
 *
 * `fetch-hardware` / `fetch-blog` / `fetch-changelog` write each page's
 * `sha256` and `bytes` at capture time. Later stages (backfill-captured-at,
 * assets, address-images, materialize and materialize-final) rewrite the same
 * `.md` files, so those hashes describe an intermediate product rather than the
 * one that ships. `verify:build-inputs` asserts the hashes of the final files,
 * so the manifests have to be refreshed at the end of the pipeline.
 *
 * This tool only touches `sha256` and `bytes`. `generated_at` (and with it the
 * `captured_at` front matter written from it), `source_url`, `slug`, titles,
 * categories, `body_sha256` and every other field are left byte-for-byte alone.
 * The hash/size are computed exactly like the fetch stages and
 * `verify:build-inputs`: SHA-256 over the UTF-8 text and Buffer.byteLength.
 *
 * Usage:
 *   node tools/sync/refresh-zone-manifests.mjs --check  # read-only gate, drift => exit 1
 *   node tools/sync/refresh-zone-manifests.mjs          # default: write manifests
 *   node tools/sync/refresh-zone-manifests.mjs --write  # explicit write
 *
 * Exit 0 iff no drift remains (--check) / every manifest was refreshed
 * successfully (--write). Missing files, extra files or unreadable manifests
 * always fail, in either mode.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ZONES = [
  {name: 'hardware', dir: 'hardware', manifest: 'data/manifests/hardware.json'},
  {name: 'blog', dir: 'blog', manifest: 'data/manifests/blog.json'},
  {name: 'changelog', dir: 'changelog', manifest: 'data/manifests/changelog.json'},
];

// --check wins when both flags are given: a gate must never mutate a manifest.
const CHECK = process.argv.includes('--check');
const MODE = CHECK ? 'check' : 'write';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** All .md files below a content root, as repo-relative paths. */
function markdownFiles(dir) {
  const root = path.join(REPO, dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(path.relative(REPO, full));
    }
  };
  walk(root);
  return out.sort();
}

const totals = {refreshed: 0, total: 0, missing: 0, extra: 0};
const problems = [];

console.log(`refresh-zone-manifests  mode=${MODE}  repo=${REPO}`);

for (const zone of ZONES) {
  const manifestPath = path.join(REPO, zone.manifest);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    problems.push(`${zone.name}: cannot read ${zone.manifest}: ${error.message}`);
    console.log(`  ${zone.name.padEnd(10)} MANIFEST UNREADABLE (${zone.manifest})`);
    continue;
  }
  const pages = manifest.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    problems.push(`${zone.name}: ${zone.manifest} has no pages`);
    console.log(`  ${zone.name.padEnd(10)} NO PAGES (${zone.manifest})`);
    continue;
  }

  // Path/slug inventory must agree with the manifest in both directions:
  // a missing product cannot be refreshed, and an extra one cannot be fixed
  // here (verify:build-inputs fails on it too).
  const local = markdownFiles(zone.dir);
  if (local === null) {
    problems.push(`${zone.name}: ${zone.dir}/ directory is missing`);
    console.log(`  ${zone.name.padEnd(10)} CONTENT ROOT MISSING (${zone.dir}/)`);
    continue;
  }
  const manifestPaths = new Set();
  for (const entry of pages) {
    manifestPaths.add(entry.local_path || path.join(zone.dir, `${entry.slug}.md`));
  }
  const extra = local.filter((relative) => !manifestPaths.has(relative));
  if (extra.length) {
    problems.push(`${zone.name}: ${extra.length} local .md file(s) absent from manifest (${extra.slice(0, 8).join(', ')})`);
  }

  let refreshed = 0;
  let missing = 0;
  for (const entry of pages) {
    const relative = entry.local_path || path.join(zone.dir, `${entry.slug}.md`);
    const file = path.join(REPO, relative);
    if (!fs.existsSync(file)) {
      problems.push(`${zone.name}: manifest page ${relative} is missing on disk`);
      missing++;
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const actualSha = sha256(text);
    const actualBytes = Buffer.byteLength(text, 'utf8');
    if (entry.sha256 === actualSha && entry.bytes === actualBytes) continue;
    refreshed++;
    if (!CHECK) {
      entry.sha256 = actualSha;
      entry.bytes = actualBytes;
    }
  }

  totals.refreshed += refreshed;
  totals.total += pages.length;
  totals.missing += missing;
  totals.extra += extra.length;
  console.log(
    `  ${zone.name.padEnd(10)} refreshed ${String(refreshed).padStart(3)}/${String(pages.length).padStart(3)}` +
      `  missing ${String(missing).padStart(2)}  extra ${String(extra.length).padStart(2)}`,
  );

  if (!CHECK && refreshed > 0) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

console.log(
  `  ${'total'.padEnd(10)} refreshed ${String(totals.refreshed).padStart(3)}/${String(totals.total).padStart(3)}` +
    `  missing ${String(totals.missing).padStart(2)}  extra ${String(totals.extra).padStart(2)}`,
);

for (const problem of problems) console.log(`  FAIL ${problem}`);

if (CHECK) {
  if (problems.length || totals.refreshed > 0) {
    console.error(
      `refresh-zone-manifests --check: ${totals.refreshed} hash/size drift(s), ` +
        `${problems.length} problem(s); manifests left untouched. Run without --check to refresh.`,
    );
    process.exit(1);
  }
  console.log('refresh-zone-manifests --check: 0 drift; every manifest page matches its final product.');
} else {
  if (problems.length) {
    console.error(`refresh-zone-manifests --write: ${problems.length} problem(s); see the FAIL lines above.`);
    process.exit(1);
  }
  console.log(
    `refresh-zone-manifests --write: ${totals.refreshed} page(s) refreshed; ` +
      'generated_at and all non-hash fields unchanged.',
  );
}
