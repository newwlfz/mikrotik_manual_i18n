#!/usr/bin/env node
/**
 * Hub-only provenance gate (no build/, no network, no writes).
 *
 * Every Markdown page that declares `source:` must also declare `captured_at`,
 * and the timestamp must equal the `generated_at` of the manifest that produced
 * the capture:
 *
 *   docs/                     -> upstream/<current-version>/manifest.json
 *   versioned_docs/version-X/ -> upstream/X/manifest.json
 *   blog/                     -> data/manifests/blog.json
 *   changelog/                -> data/manifests/changelog.json
 *   hardware/                 -> data/manifests/hardware.json
 *
 * The three zone manifests are produced by the separate zone-crawl workflow.
 * When one is not present yet its category is reported as SKIP (not PASS, not
 * FAIL); a present manifest with missing/stale timestamps fails the run.
 *
 *   node tools/verify/provenance.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {REPO, relative, walkMarkdown} from '../translate/lib/paths.mjs';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function field(frontMatter, key) {
  const raw = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm').exec(frontMatter)?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/^(['"])([\s\S]*)\1$/, '$2') || null;
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function clean(value) {
  return String(value)
    .replace(/\.mdx?$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/index$/i, '');
}

function routeOf(source) {
  try {
    return new URL(source).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

/**
 * A manifest may carry a per-page capture time; otherwise its top-level
 * `generated_at` (one fetch run per zone/version) is authoritative.
 */
function expectedTimestamp(manifest, rel, source) {
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  const keys = [clean(rel), clean(path.basename(rel)), clean(routeOf(source))].filter(Boolean);
  const pick = (page) => page?.captured_at || page?.generated_at || null;
  const candidates = (page) =>
    [page?.local_path, page?.path, page?.route, page?.source_url, page?.url]
      .filter((value) => value !== undefined && value !== null)
      .map(clean);
  for (const page of pages) {
    if (candidates(page).some((value) => keys.includes(value))) {
      if (pick(page)) return pick(page);
    }
  }
  for (const page of pages) {
    if (candidates(page).some((value) => value.split('/').pop() === clean(path.basename(rel)))) {
      if (pick(page)) return pick(page);
    }
  }
  return manifest.generated_at || null;
}

const currentFile = path.join(REPO, 'data/manifests/current-version.json');
const current = readJson(currentFile)?.version;
if (!current) throw new Error(`missing version in ${relative(REPO, currentFile)}`);

const versionedRoot = path.join(REPO, 'versioned_docs');
const archived = fs.existsSync(versionedRoot)
  ? fs
      .readdirSync(versionedRoot, {withFileTypes: true})
      .filter((entry) => entry.isDirectory() && /^version-/.test(entry.name))
      .map((entry) => ({name: entry.name, version: entry.name.slice('version-'.length)}))
      .sort((a, b) => b.version.localeCompare(a.version, undefined, {numeric: true}))
  : [];

const categories = [
  {name: 'docs', root: 'docs', manifest: `upstream/${current}/manifest.json`},
  ...archived.map(({name, version}) => ({
    name: `versioned_docs/${name}`,
    root: `versioned_docs/${name}`,
    manifest: `upstream/${version}/manifest.json`,
  })),
  {name: 'blog', root: 'blog', manifest: 'data/manifests/blog.json'},
  {name: 'changelog', root: 'changelog', manifest: 'data/manifests/changelog.json'},
  {name: 'hardware', root: 'hardware', manifest: 'data/manifests/hardware.json'},
];

const rows = [];
const examples = [];
let failures = 0;

for (const category of categories) {
  const manifestPath = path.join(REPO, category.manifest);
  const files = walkMarkdown(path.join(REPO, category.root));
  const row = {
    name: category.name,
    manifest: category.manifest,
    total: files.length,
    withSource: 0,
    ok: 0,
    missing: 0,
    stale: 0,
    unverifiable: 0,
    skipped: false,
    error: null,
  };
  const manifest = readJson(manifestPath);
  if (!manifest) {
    row.skipped = true;
    rows.push(row);
    console.log(`SKIP ${category.name} — ${category.manifest} not present`);
    continue;
  }
  if (!manifest.generated_at && !(manifest.pages || []).some((page) => page.captured_at || page.generated_at)) {
    row.error = 'manifest has no generated_at';
    failures++;
    rows.push(row);
    console.log(`FAIL ${category.name} — ${row.error}`);
    continue;
  }
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const frontMatter = FRONT_MATTER.exec(text)?.[1] || '';
    const source = field(frontMatter, 'source');
    if (!source) continue;
    row.withSource++;
    const rel = relative(path.join(REPO, category.root), file);
    const captured = field(frontMatter, 'captured_at');
    const expected = expectedTimestamp(manifest, rel, source);
    if (!captured) {
      row.missing++;
      if (examples.length < 12) examples.push(`${category.name}/${rel}: missing captured_at`);
    } else if (!expected) {
      row.unverifiable++;
      if (examples.length < 12) examples.push(`${category.name}/${rel}: no manifest timestamp`);
    } else if (captured !== expected) {
      row.stale++;
      if (examples.length < 12) examples.push(`${category.name}/${rel}: ${captured} != ${expected}`);
    } else {
      row.ok++;
    }
  }
  if (row.missing || row.stale || row.unverifiable || row.error) failures++;
  rows.push(row);
}

const header = ['category', 'total', 'withSource', 'ok', 'missing', 'stale', 'unverifiable', 'manifest'];
const width = header.map((name) => Math.max(name.length, ...rows.map((row) => String(row[name] || row.manifest).length)));
const format = (values) => values.map((value, index) => String(value).padEnd(width[index])).join('  ');
console.log('');
console.log(format(header));
for (const row of rows) {
  console.log(
    format([
      row.name,
      row.total,
      row.withSource,
      row.ok,
      row.missing,
      row.stale,
      row.unverifiable,
      row.skipped ? `${row.manifest} (SKIP)` : row.manifest,
    ]),
  );
}
const total = rows.reduce(
  (sum, row) => {
    for (const key of ['total', 'withSource', 'ok', 'missing', 'stale', 'unverifiable']) sum[key] += row[key];
    return sum;
  },
  {total: 0, withSource: 0, ok: 0, missing: 0, stale: 0, unverifiable: 0},
);
console.log(
  format(['TOTAL', total.total, total.withSource, total.ok, total.missing, total.stale, total.unverifiable, '']),
);
if (examples.length) {
  console.log('');
  console.log('First offending pages:');
  for (const example of examples) console.log(`- ${example}`);
}
if (failures) {
  console.error(
    `\nprovenance check failed: ${failures} categor(y|ies) with missing/stale/unverifiable captured_at`,
  );
  process.exitCode = 1;
} else {
  console.log('\nprovenance check passed');
}
