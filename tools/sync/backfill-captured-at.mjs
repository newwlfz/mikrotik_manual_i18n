#!/usr/bin/env node
/**
 * Restore the missing `captured_at` front-matter key from the offline capture.
 *
 * The 7.24/7.25 snapshots were captured by the legacy crawl and carry a
 * per-page `captured_at`; the 7.26 tree was materialised from
 * `upstream/7.26/` and lost it. The fetch manifest records the time of that
 * run (`generated_at`) and the SHA-256 of every downloaded Markdown file, so
 * the timestamp can be put back without touching the network.
 *
 * Safety rules:
 *   - only a page listed as `origin: "official"` in the manifest is touched;
 *   - the corresponding `upstream/<version>/docs/...` file must still hash to
 *     the manifest's `sha256`, which proves the manifest describes the bytes
 *     this mirror captured;
 *   - the page's `source:` must match the manifest's `source_url`;
 *   - a page that already has `captured_at` is left byte for byte;
 *   - the default is a report; `--write` is required to change `docs/`.
 *
 *   node tools/sync/backfill-captured-at.mjs                 # report only
 *   node tools/sync/backfill-captured-at.mjs --write         # current version
 *   node tools/sync/backfill-captured-at.mjs --version=7.26 --write
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const WRITE = process.argv.includes('--write');
const CURRENT = JSON.parse(
  fs.readFileSync(path.join(REPO, 'data/manifests/current-version.json'), 'utf8'),
).version;
const VERSION = arg('version', '') || CURRENT;
const MANIFEST = path.join(REPO, `upstream/${VERSION}/manifest.json`);
const DOCS_DIR = path.join(REPO, VERSION === CURRENT ? 'docs' : `versioned_docs/version-${VERSION}`);
const UPSTREAM_DIR = path.join(REPO, `upstream/${VERSION}/docs`);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function withCapturedAt(text, timestamp) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return null;
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const lines = match[1].split(/\r?\n/);
  if (lines.some((line) => /^captured_at\s*:/.test(line))) return text;
  const line = `captured_at: '${timestamp}'`;
  const source = lines.findIndex((entry) => /^source\s*:/.test(entry));
  if (source === -1) lines.push(line);
  else lines.splice(source + 1, 0, line);
  return `${text.slice(0, match.index)}---${eol}${lines.join(eol)}${eol}---${text.slice(
    match.index + match[0].length,
  )}`;
}

if (!fs.existsSync(MANIFEST)) throw new Error(`missing ${path.relative(REPO, MANIFEST)}`);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const timestamp = manifest.generated_at;
if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) {
  throw new Error('manifest has no usable generated_at');
}

const report = {version: VERSION, timestamp, pages: 0, present: 0, added: 0, wouldAdd: 0, skipped: []};

for (const page of manifest.pages || []) {
  if (page.origin !== 'official' || !page.local_path) continue;
  report.pages++;
  const docsFile = path.join(DOCS_DIR, page.local_path);
  const upstreamFile = path.join(UPSTREAM_DIR, page.local_path);
  if (!fs.existsSync(docsFile) || !fs.existsSync(upstreamFile)) {
    report.skipped.push(`${page.local_path}: missing local or upstream file`);
    continue;
  }
  if (sha256(upstreamFile) !== page.sha256) {
    report.skipped.push(`${page.local_path}: upstream hash changed`);
    continue;
  }
  const text = fs.readFileSync(docsFile, 'utf8');
  const frontMatter = FRONT_MATTER.exec(text)?.[1] || '';
  if (/^captured_at\s*:/m.test(frontMatter)) {
    report.present++;
    continue;
  }
  const source = /^source\s*:\s*(.+)$/m.exec(frontMatter)?.[1]?.trim();
  const wanted = String(page.source_url || '').replace(/\.md$/i, '');
  if (!source || source !== wanted) {
    report.skipped.push(`${page.local_path}: source mismatch`);
    continue;
  }
  const next = withCapturedAt(text, timestamp);
  if (next === null) {
    report.skipped.push(`${page.local_path}: no front matter`);
    continue;
  }
  report.wouldAdd++;
  if (WRITE) {
    fs.writeFileSync(docsFile, next);
    report.added++;
  }
}

console.log(JSON.stringify(report, null, 1));
if (!WRITE) console.log('dry run only; re-run with --write to update the docs tree');
