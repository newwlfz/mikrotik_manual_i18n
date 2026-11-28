#!/usr/bin/env node
/**
 * Restore / refresh `captured_at` front matter from the offline capture.
 *
 * The manifest of every release records the time of the capture run in its
 * top-level `generated_at` and the SHA-256 of every downloaded Markdown file.
 * A materialize pass that rebuilds a page from the official `.md` export drops
 * `captured_at` (the export has no such key), so it must be put back without
 * touching the network.
 *
 * Safety rules:
 *   - only a page listed as `origin: "official"` in the manifest is touched;
 *   - the corresponding `upstream/<version>/docs/...` file must still hash to
 *     the manifest's `sha256`, which proves the manifest describes the bytes
 *     this mirror captured;
 *   - the page's `source:` must match the manifest's `source_url`;
 *   - a page whose `captured_at` already equals `generated_at` is left byte for
 *     byte (a stale one is refreshed);
 *   - the default is a report; `--check` is a gate and `--write` changes files.
 *
 *   node tools/sync/backfill-captured-at.mjs                    # all versions, report
 *   node tools/sync/backfill-captured-at.mjs --check            # gate: fail if a page needs it
 *   node tools/sync/backfill-captured-at.mjs --write            # all versions
 *   node tools/sync/backfill-captured-at.mjs --version=7.25 --write
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {allVersions, isCurrent} from './lib/versions.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const REQUESTED = arg('version', '');
// Current release first, then archives newest to oldest; `--version` narrows it.
const versions = REQUESTED ? [REQUESTED] : allVersions();

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function readCapturedAt(text) {
  const frontMatter = FRONT_MATTER.exec(text)?.[1] || '';
  const raw = /^captured_at\s*:\s*(.+)$/m.exec(frontMatter)?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/^(['"])([\s\S]*)\1$/, '$2');
}

/** Insert after `source:` (or refresh an existing value), keeping EOL style. */
function setCapturedAt(text, timestamp) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return null;
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const lines = match[1].split(/\r?\n/);
  const line = `captured_at: '${timestamp}'`;
  const existing = lines.findIndex((entry) => /^captured_at\s*:/.test(entry));
  if (existing >= 0) {
    lines[existing] = line;
  } else {
    const source = lines.findIndex((entry) => /^source\s*:/.test(entry));
    if (source === -1) lines.push(line);
    else lines.splice(source + 1, 0, line);
  }
  return `${text.slice(0, match.index)}---${eol}${lines.join(eol)}${eol}---${text.slice(
    match.index + match[0].length,
  )}`;
}

const report = {
  schema: 1,
  mode: CHECK ? 'check' : WRITE ? 'write' : 'report',
  versions: {},
  totals: {pages: 0, present: 0, wouldAdd: 0, stale: 0, added: 0, refreshed: 0, skipped: 0},
};

for (const version of versions) {
  const manifestFile = path.join(REPO, `upstream/${version}/manifest.json`);
  if (!fs.existsSync(manifestFile)) throw new Error(`missing ${path.relative(REPO, manifestFile)}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const timestamp = manifest.generated_at;
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error(`${version}: manifest has no usable generated_at`);
  }
  const docsDir = path.join(REPO, isCurrent(version) ? 'docs' : `versioned_docs/version-${version}`);
  const upstreamDir = path.join(REPO, `upstream/${version}/docs`);
  const result = {
    timestamp,
    docs_dir: path.relative(REPO, docsDir),
    pages: 0,
    present: 0,
    wouldAdd: 0,
    stale: 0,
    added: 0,
    refreshed: 0,
    skipped: [],
  };

  for (const page of manifest.pages || []) {
    if (page.origin !== 'official' || !page.local_path) continue;
    result.pages++;
    const docsFile = path.join(docsDir, page.local_path);
    const upstreamFile = path.join(upstreamDir, page.local_path);
    if (!fs.existsSync(docsFile) || !fs.existsSync(upstreamFile)) {
      result.skipped.push(`${page.local_path}: missing local or upstream file`);
      continue;
    }
    if (sha256(upstreamFile) !== page.sha256) {
      result.skipped.push(`${page.local_path}: upstream hash changed`);
      continue;
    }
    const text = fs.readFileSync(docsFile, 'utf8');
    const frontMatter = FRONT_MATTER.exec(text)?.[1] || '';
    const source = /^source\s*:\s*(.+)$/m.exec(frontMatter)?.[1]?.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    const wanted = String(page.source_url || '').replace(/\.md$/i, '');
    if (!source || source !== wanted) {
      result.skipped.push(`${page.local_path}: source mismatch`);
      continue;
    }
    const captured = readCapturedAt(text);
    if (captured === timestamp) {
      result.present++;
      continue;
    }
    if (captured) result.stale++;
    else result.wouldAdd++;
    const next = setCapturedAt(text, timestamp);
    if (next === null) {
      result.skipped.push(`${page.local_path}: no front matter`);
      continue;
    }
    if (WRITE) {
      fs.writeFileSync(docsFile, next);
      if (captured) result.refreshed++;
      else result.added++;
    }
  }

  report.versions[version] = result;
  for (const key of ['pages', 'present', 'wouldAdd', 'stale', 'added', 'refreshed']) {
    report.totals[key] += result[key];
  }
  report.totals.skipped += result.skipped.length;
  console.log(
    `${version}: timestamp=${timestamp} pages=${result.pages} present=${result.present} ` +
      `missing=${result.wouldAdd} stale=${result.stale} added=${result.added} ` +
      `refreshed=${result.refreshed} skipped=${result.skipped.length}`,
  );
}

console.log(JSON.stringify(report, null, 1));
if (!WRITE && !CHECK) console.log('dry run only; re-run with --write to update the docs tree');
if (CHECK && report.totals.wouldAdd + report.totals.stale > 0) {
  console.error(
    `backfill check found ${report.totals.wouldAdd} missing and ${report.totals.stale} stale captured_at value(s)`,
  );
  process.exitCode = 1;
}
