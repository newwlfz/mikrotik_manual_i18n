#!/usr/bin/env node
/**
 * `npm run verify:build-inputs` — fail-closed build-input gate.
 *
 * The old contract called `hardware/`, `blog/` and `changelog/` committed HEAD
 * source data that the pipeline never generated. That was the root cause of
 * these sections being stuck on a stale snapshot. They are now real pipeline
 * products: `fetch-hardware` / `fetch-blog` / `fetch-changelog` write them and
 * a page-level manifest (`data/manifests/<section>.json`) with `generated_at`,
 * `source_url`, `sha256` and `bytes` on every run.
 *
 * This gate proves, without building or network access, that each product is
 * complete and belongs to the current fetch: manifest slugs == local slugs,
 * every `.md` carries `source` and `captured_at`, and `captured_at` equals the
 * manifest's `generated_at`. It also keeps the untouched `static/img` and
 * `static/assets` source-data floors (losing them would 404 every image and
 * download). Any failure means "re-run the three fetch stages", never
 * "git checkout the content roots".
 *
 * A cold checkout (code skeleton only, before the first `sync`) has no
 * `data/manifests/current-version.json` and therefore no fetch products yet.
 * In that one state the product gates are skipped and the gate exits 0. As soon
 * as the file exists — created by `install-version` — every check below stays
 * unchanged and fail-closed.
 *
 * Exit 0 iff every declared input is present, complete and current (or the
 * repository is genuinely cold).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {
  OFFICIAL_CHANGELOG_SNAPSHOT,
  fetchOfficialChangelogLatest,
} from '../sync/lib/official-zones.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FETCH_SECTIONS = [
  {name: 'hardware', dir: 'hardware', manifest: 'data/manifests/hardware.json'},
  {name: 'blog', dir: 'blog', manifest: 'data/manifests/blog.json'},
  {name: 'changelog', dir: 'changelog', manifest: 'data/manifests/changelog.json'},
];
// Static asset trees are still committed source data (not generated here).
const STATIC_INPUTS = [
  {dir: 'static/img', minFiles: 1700},
  {dir: 'static/assets', minFiles: 60},
];

// `install-version` creates this file on the first `sync`. A repository that
// only carries the code skeleton (delete-and-rebuild, code push before the
// official re-capture) cannot have any of the products checked below, so a
// missing file is the one and only cold-start signal. Its presence restores
// the unchanged fail-closed gates — no threshold is relaxed.
const CURRENT_VERSION_MANIFEST = 'data/manifests/current-version.json';
const COLD_START_MESSAGE =
  '[build-inputs] cold-start: no current-version.json; skipping fetch-product gates';

function isColdStart() {
  return !fs.existsSync(path.join(REPO, CURRENT_VERSION_MANIFEST));
}

/**
 * static/img holds HEAD-committed source data (blobs named by blog/changelog/
 * hardware pages), not pipeline output. The coarse `minFiles` floor cannot see
 * a partial deletion once enough untracked blobs exist: this exact check fails
 * when even one HEAD-tracked blob is missing.
 */
function verifyHeadTrackedStaticImg(dir, fail, lines) {
  const git = spawnSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', dir], {
    cwd: REPO, encoding: 'utf8',
  });
  if (git.error || git.status !== 0) {
    fail(`${dir}: cannot enumerate HEAD-tracked files (${git.error?.message || git.stderr?.trim()})`);
    return;
  }
  const headTracked = git.stdout.split('\0').filter(Boolean).map((entry) => path.relative(REPO, path.join(REPO, entry)));
  const root = path.join(REPO, dir);
  let total = 0;
  if (fs.existsSync(root)) {
    for (const name of fs.readdirSync(root)) {
      try {
        if (fs.statSync(path.join(root, name)).isFile()) total++;
      } catch { /* vanished during scan */ }
    }
  }
  const present = headTracked.filter((rel) => fs.existsSync(path.join(REPO, rel)));
  const missing = headTracked.filter((rel) => !fs.existsSync(path.join(REPO, rel)));
  console.log(
    `  static/img HEAD check: total=${total} headTracked=${headTracked.length} ` +
      `present=${present.length} missing=${missing.length}`,
  );
  if (missing.length) {
    fail(`${dir}: ${missing.length} HEAD-tracked file(s) missing ` +
      `(${missing.slice(0, 8).join(', ')}); restore with \`git checkout HEAD -- ${dir}\` ` +
      'and fix tools/sync/address-images.mjs pruning');
  } else {
    lines.push(`  ok   ${dir.padEnd(9)} all ${headTracked.length} HEAD-tracked files present`);
  }
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Freshness baseline for the changelog comes from the official index, not from
 * a hand-maintained floor. Precedence: an explicit `--online` read, then a
 * refreshed cache written by `report-update --zones --write`, then the cached
 * official-index observation shipped in lib/official-zones.mjs.
 */
function cachedOfficialChangelogLatest() {
  const cache = readJson('data/manifests/official-zones.json');
  const slug = cache?.changelog?.latest_slug;
  if (slug) return {slug, source: `cached official-zones manifest (${cache.captured_at || 'unknown capture'})`};
  return {
    slug: OFFICIAL_CHANGELOG_SNAPSHOT.latest_slug,
    source: `official index observation ${OFFICIAL_CHANGELOG_SNAPSHOT.captured_at}`,
  };
}

function readJson(relative) {
  const file = path.join(REPO, relative);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function markdownFiles(dir) {
  const root = path.join(REPO, dir);
  const out = [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return out;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out.sort();
}

function countFiles(dir) {
  const root = path.join(REPO, dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  let count = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else count++;
    }
  };
  walk(root);
  return count;
}

function parseMarkdown(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = FRONT_MATTER.exec(text);
  const lines = match ? match[1].split(/\r?\n/) : [];
  const read = (key) => {
    const hit = lines.find((line) => line.startsWith(`${key}:`));
    return hit ? hit.slice(key.length + 1).trim().replace(/^'|'$/g, '') : null;
  };
  return {
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    bytes: Buffer.byteLength(text, 'utf8'),
    source: read('source'),
    capturedAt: read('captured_at'),
  };
}

/** @returns {{ok: boolean, lines: string[], problems: string[]}} */
export function verifyBuildInputs({officialLatest = cachedOfficialChangelogLatest()} = {}) {
  if (isColdStart()) {
    console.log(COLD_START_MESSAGE);
    return {ok: true, coldStart: true, lines: [], problems: []};
  }
  const lines = [];
  const problems = [];
  const fail = (message) => {
    problems.push(message);
    lines.push(`  FAIL ${message}`);
  };

  for (const {name, dir, manifest: manifestPath} of FETCH_SECTIONS) {
    const manifest = readJson(manifestPath);
    if (!manifest) {
      fail(`${name}: missing ${manifestPath}; re-run node tools/sync/fetch-${name}.mjs`);
      continue;
    }
    const generatedAt = manifest.generated_at;
    if (!generatedAt || Number.isNaN(new Date(generatedAt).getTime())) {
      fail(`${name}: ${manifestPath} has no usable generated_at; re-run node tools/sync/fetch-${name}.mjs`);
      continue;
    }
    const entries = manifest.pages || [];
    if (!entries.length) {
      fail(`${name}: ${manifestPath} has no pages; re-run node tools/sync/fetch-${name}.mjs`);
      continue;
    }
    const expected = new Map();
    for (const entry of entries) {
      const relative = entry.local_path || `${dir}/${entry.slug}.md`;
      const slug = entry.slug || path.basename(relative, '.md');
      expected.set(slug, {relative, entry});
    }
    const local = markdownFiles(dir);
    const localBySlug = new Map(
      local.map((relative) => [path.basename(relative, '.md'), relative]),
    );
    if (local.length < expected.size) {
      fail(`${name}: ${local.length} local .md files < ${expected.size} in manifest; re-run node tools/sync/fetch-${name}.mjs`);
    }
    for (const [slug, {relative, entry}] of expected) {
      const actual = localBySlug.get(slug);
      if (!actual) {
        fail(`${name}: manifest page ${relative} is missing on disk; re-run node tools/sync/fetch-${name}.mjs`);
        continue;
      }
      if (path.join(dir, actual) !== relative) {
        fail(`${name}: ${slug} is at ${path.join(dir, actual)}, manifest says ${relative}`);
      }
    }
    const extras = [...localBySlug.keys()].filter((slug) => !expected.has(slug));
    if (extras.length) {
      fail(`${name}: ${extras.length} local slug(s) absent from manifest (${extras.slice(0, 8).join(', ')}); re-run node tools/sync/fetch-${name}.mjs and prune orphans`);
    }
    let checked = 0;
    for (const relative of local) {
      const file = path.join(REPO, dir, relative);
      const facts = parseMarkdown(file);
      const entry = expected.get(path.basename(relative, '.md'))?.entry;
      const issues = [];
      if (!facts.source) issues.push('no source');
      if (facts.capturedAt !== generatedAt) {
        issues.push(`captured_at ${facts.capturedAt} != generated_at ${generatedAt}`);
      }
      if (entry?.sha256 && facts.sha256 !== entry.sha256) issues.push('sha256 mismatch');
      if (entry?.bytes && facts.bytes !== entry.bytes) issues.push('bytes mismatch');
      if (issues.length) {
        fail(`${path.join(dir, relative)}: ${issues.join(', ')}; re-run node tools/sync/fetch-${name}.mjs`);
      } else {
        checked++;
      }
    }
    lines.push(`  ok   ${name.padEnd(9)} ${checked}/${local.length} md aligned with manifest (generated_at ${generatedAt})`);

    if (name === 'changelog') {
      const latest = manifest.latest_slug || entries[0]?.slug;
      const official = officialLatest?.slug;
      if (!official) {
        fail('changelog: official index has no latest slug; refresh with report-update --zones --write');
      } else if (!latest || latest < official) {
        fail(`changelog: latest_slug ${latest} < official index ${official} (${officialLatest.source}); re-run node tools/sync/fetch-changelog.mjs`);
      } else if (!localBySlug.has(latest)) {
        fail(`changelog: latest slug ${latest} has no local page; re-run node tools/sync/fetch-changelog.mjs`);
      } else {
        lines.push(`  ok   changelog latest_slug ${latest} >= official index ${official} (${officialLatest.source})`);
      }
    }
  }

  for (const {dir, minFiles} of STATIC_INPUTS) {
    const count = countFiles(dir);
    if (count === null || count < minFiles) {
      fail(`${dir}: ${count === null ? 'MISSING' : count} files (min ${minFiles}); restore the committed source data`);
    } else {
      lines.push(`  ok   ${dir.padEnd(9)} ${count} files (min ${minFiles})`);
    }
  }
  verifyHeadTrackedStaticImg('static/img', fail, lines);

  // favicon 不是 Docusaurus 的 `favicon:` 字段，而是 headTags 指向的静态文件：
  // 它同样是 fetch stage 的产物，manifest 缺失/本地字节漂移都要在构建前
  // fail-closed。generated_at 沿用三区 manifest 的 provenance 模式。
  const faviconManifest = readJson('data/manifests/favicon.json');
  if (!faviconManifest) {
    fail('favicon: missing data/manifests/favicon.json; re-run node tools/sync/fetch-favicon.mjs');
  } else {
    const stamp = faviconManifest.generated_at;
    if (!stamp || Number.isNaN(new Date(stamp).getTime())) {
      fail('favicon: data/manifests/favicon.json has no usable generated_at; re-run node tools/sync/fetch-favicon.mjs');
    }
    const faviconFile = path.join(REPO, 'static/img/favicon.svg');
    if (!fs.existsSync(faviconFile)) {
      fail('favicon: missing static/img/favicon.svg; re-run node tools/sync/fetch-favicon.mjs');
    } else {
      const bytes = fs.readFileSync(faviconFile);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      if (digest !== faviconManifest.sha256) {
        fail(`favicon: static/img/favicon.svg sha256 ${digest} != manifest ${faviconManifest.sha256}; re-run node tools/sync/fetch-favicon.mjs`);
      }
      if (bytes.length !== faviconManifest.bytes) {
        fail(`favicon: static/img/favicon.svg ${bytes.length} B != manifest ${faviconManifest.bytes} B; re-run node tools/sync/fetch-favicon.mjs`);
      }
      if (digest === faviconManifest.sha256 && bytes.length === faviconManifest.bytes) {
        lines.push(`  ok   favicon    ${bytes.length} B sha256=${digest} (generated_at ${stamp})`);
      }
    }
  }
  return {ok: problems.length === 0, lines, problems};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('verify:build-inputs  fetch products + committed static source data');
  // Bail before the optional network read too: a cold checkout has nothing to
  // verify and must not depend on the official index being reachable.
  if (isColdStart()) {
    console.log(COLD_START_MESSAGE);
    process.exit(0);
  }
  let officialLatest;
  if (process.argv.includes('--online')) {
    try {
      officialLatest = await fetchOfficialChangelogLatest();
    } catch (error) {
      console.error(`verify:build-inputs --online: cannot read the official changelog index: ${error.message}`);
      process.exit(2);
    }
  }
  const result = verifyBuildInputs({officialLatest: officialLatest || cachedOfficialChangelogLatest()});
  for (const line of result.lines) console.log(line);
  if (!result.ok) {
    console.error(
      `verify:build-inputs: ${result.problems.length} problem(s); ` +
        're-run `node tools/sync/fetch-hardware.mjs`, `fetch-blog.mjs` and ' +
        '`fetch-changelog.mjs` (or restore the committed static asset trees).',
    );
    process.exit(1);
  }
  console.log('verify:build-inputs: all fetch products present, complete and current.');
}
