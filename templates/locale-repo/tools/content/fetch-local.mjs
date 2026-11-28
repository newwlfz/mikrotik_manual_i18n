#!/usr/bin/env node
/**
 * Fetch the **content** half of the Chinese mirror from a local English
 * checkout — a stand-in for downloading a content release from the hub.
 *
 * This repository tracks code, configuration and the *published* content:
 * everything a reader browses (`docs/`, `versioned_docs/`, `hardware/`,
 * `blog/`, `changelog/`) plus the build-time manifests and CLI data (`data/`)
 * is produced upstream and committed here by the hub's `publish-content` job
 * (git push), so a normal checkout already has it. `npm run content:fetch`
 * remains a local-preview fallback that re-materialises those roots, and a
 * replay path for an older content release.
 *
 * **`static/` is not content of this repository.** Images, PDFs, videos and the
 * CLI data live on the English site (the asset host); this site references them
 * through `ASSET_ORIGIN` (see `guides/CI.md`). The hub content release still
 * carries `static/` for the English site, so the production path extracts the
 * archive without it (`tar --exclude`) and removes any leftover copy: a stale
 * `static/` would be ignored by the build (`staticDirectories: []`) but would
 * still waste time and disk here.
 *
 * **CI does not call this tool any more.** The hub
 * (`newwlfz/mikrotik_manual_i18n`) publishes its English source by git push —
 * its `publish-content` job commits every `CONTENT_ROOTS` root plus
 * `locales.json` into this repository, and `pages.yml` builds from that
 * checkout. This script is the **local preview** fallback: it materialises the
 * content roots a build needs when you do not want to wait for the hub, and it
 * accepts the old release URL (`--url=` / `CONTENT_URL`) so a developer can
 * reproduce a published content package offline.
 *
 * In the release form the archive is downloaded with
 * `curl -L --fail --retry 3`, extracted with `tar` into the repository root, and
 * every section is checked before the build starts. Mind that the extraction
 * also writes `docs/`; that tree now comes from git, so a stale archive would
 * silently roll it back — use the sibling-checkout mode when you only need the
 * other content roots.
 *
 * Without `CONTENT_URL` the local path stays offline-only: it copies from a
 * sibling `repo_en` checkout (override with `CONTENT_SOURCE` or `--source=`).
 *
 * Behaviour:
 *   - sections are copied recursively into the same relative paths;
 *   - a destination file whose size already equals the source is skipped, so a
 *     second run is cheap and does not touch mtimes (Docusaurus' MDX cache
 *     stays warm);
 *   - `--force` re-copies every file, `--dry-run` prints without writing,
 *     `--only=docs,hardware` restricts the sections;
 *   - a machine-readable summary is written to `.content/fetch.json`.
 *
 * Usage:
 *   node tools/content/fetch-local.mjs
 *   node tools/content/fetch-local.mjs --source=../repo_en --only=docs,hardware
 *   node tools/content/fetch-local.mjs --url=https://…/content-v1.tar.zst
 *   node tools/content/fetch-local.mjs --dry-run --json
 *
 * Exit codes: 0 = content present, 1 = source missing, download/extract failed
 * or the archive lacks a section.
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Sections a full build needs. `data/` is content too: the CLI data and the
 * version manifests are generated upstream, not maintained here.
 *
 * `static/` is deliberately absent: this site serves assets from the English
 * site (`ASSET_ORIGIN`), so copying them here has no effect on the build. */
const SECTIONS = ['docs', 'versioned_docs', 'hardware', 'blog', 'changelog', 'data'];
/** Sections that exist in the hub archive but must not be materialized here. */
const EXCLUDED_SECTIONS = ['static'];

function parseArgs(argv) {
  const options = {
    source: process.env.CONTENT_SOURCE || path.join(REPO, '..', 'repo_en'),
    url: process.env.CONTENT_URL || null,
    keepArchive: false,
    only: null,
    force: false,
    dryRun: false,
    json: false,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'usage: node tools/content/fetch-local.mjs [--source=<dir>] [--only=<a,b>]',
          '                                             [--url=<archive>] [--keep-archive]',
          '                                             [--force] [--dry-run] [--json]',
          '',
          `sections: ${SECTIONS.join(', ')}`,
          `not fetched: ${EXCLUDED_SECTIONS.join(', ')} (served by ASSET_ORIGIN)`,
          'env: CONTENT_URL (download+extract the hub content release instead of copying)',
          '     CONTENT_SOURCE (default ../repo_en)',
        ].join('\n'),
      );
      process.exit(0);
    }
    if (arg === '--force') options.force = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--keep-archive') options.keepArchive = true;
    else if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
    else if (arg.startsWith('--source=')) options.source = arg.slice('--source='.length);
    else if (arg.startsWith('--only=')) {
      options.only = arg
        .slice('--only='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  options.source = path.resolve(REPO, options.source);
  return options;
}

const options = parseArgs(process.argv.slice(2));
const sections = options.only
  ? SECTIONS.filter((section) => options.only.includes(section))
  : SECTIONS;
const unknown = options.only
  ? options.only.filter((section) => !SECTIONS.includes(section))
  : [];
if (unknown.length > 0) {
  throw new Error(`unknown section(s): ${unknown.join(', ')}; known: ${SECTIONS.join(', ')}`);
}

function sourceCommit(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function walk(dir, visit, relative = '') {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    const rel = relative ? path.posix.join(relative, entry.name) : entry.name;
    if (entry.isSymbolicLink()) {
      visit(full, rel, 'link');
    } else if (entry.isDirectory()) {
      walk(full, visit, rel);
    } else if (entry.isFile()) {
      visit(full, rel, 'file');
    }
  }
}

function ensureDir(dir) {
  if (options.dryRun) return;
  fs.mkdirSync(dir, {recursive: true});
}

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

/**
 * Production path (`CONTENT_URL` / `--url=`): download the hub content release,
 * extract it at the repository root, and inventory every section.
 *
 * The two shell commands match `Fetch content release` in `.github/workflows/
 * pages.yml` on purpose: this mode is how the same package can be replayed
 * locally without `gh`. `--dry-run` prints the download without touching disk.
 */
function materializeFromUrl(url) {
  const archiveName = path.basename(new URL(url).pathname) || 'content.tar.zst';
  const archivePath = path.join(REPO, '.content', archiveName);
  const summary = {
    source: {url, archive: archivePath, bytes: 0, downloadedAt: null},
    sections: [],
    copied: 0,
    skipped: 0,
    bytesCopied: 0,
    bytesSkipped: 0,
    bySection: {},
  };
  if (options.dryRun) {
    console.log(`[content:fetch] would download ${url} -> ${archivePath} and extract with tar`);
    return summary;
  }

  ensureDir(path.dirname(archivePath));
  console.log(`[content:fetch] downloading ${url}`);
  execFileSync(
    'curl',
    ['-L', '--fail', '--retry', '3', '--retry-delay', '5', '--silent', '--show-error', '-o', archivePath, url],
    {stdio: ['ignore', 'inherit', 'inherit']},
  );
  const bytes = fs.statSync(archivePath).size;
  summary.source.bytes = bytes;
  summary.source.downloadedAt = new Date().toISOString();
  console.log(`[content:fetch] downloaded ${mib(bytes)}`);

  const tarArgs = [
    ...(/\.zst$/i.test(archiveName) ? ['--zstd'] : /\.(?:tar\.)?gz$/i.test(archiveName) ? ['-z'] : []),
    // The hub archive carries `static/` for the English site; this repository
    // does not keep it (assets are served from `ASSET_ORIGIN`).
    ...EXCLUDED_SECTIONS.flatMap((section) => ['--exclude', `./${section}`, '--exclude', section]),
    '-xf',
    archivePath,
    '-C',
    REPO,
  ];
  execFileSync('tar', tarArgs, {stdio: 'inherit'});
  if (!options.keepArchive) fs.rmSync(archivePath, {force: true});

  // `--exclude` is not honoured by every tar implementation (and an archive
  // may store the entry with another prefix): make the contract explicit.
  for (const section of EXCLUDED_SECTIONS) {
    const target = path.join(REPO, section);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, {recursive: true, force: true});
    console.log(`[content:fetch] removed ${section}/ (assets are served by ASSET_ORIGIN)`);
  }

  const missing = sections.filter((section) => !fs.existsSync(path.join(REPO, section)));
  if (missing.length > 0) {
    throw new Error(`content archive is missing section(s): ${missing.join(', ')}`);
  }
  summary.sections = [...sections];
  for (const section of sections) {
    const stats = {files: 0, copied: 0, skipped: 0, bytes: 0, bytesCopied: 0, bytesSkipped: 0};
    walk(path.join(REPO, section), (src, rel, kind) => {
      stats.files += 1;
      if (kind === 'file') stats.bytes += fs.statSync(src).size;
    });
    summary.bySection[section] = stats;
    summary.copied += stats.files;
    summary.bytesCopied += stats.bytes;
  }

  for (const [section, stats] of Object.entries(summary.bySection)) {
    console.log(
      `[content:fetch] ${`${section}/`.padEnd(18)} ${String(stats.files).padStart(6)} files  ` +
        `${mib(stats.bytes).padStart(10)}`,
    );
  }
  console.log(
    `[content:fetch] extracted ${summary.copied} files (${mib(summary.bytesCopied)}) from ${archiveName}`,
  );
  return summary;
}

if (options.url) {
  const urlSummary = materializeFromUrl(options.url);
  if (!options.dryRun) {
    const outFile = path.join(REPO, '.content', 'fetch.json');
    fs.mkdirSync(path.dirname(outFile), {recursive: true});
    fs.writeFileSync(
      outFile,
      `${JSON.stringify({...urlSummary, fetchedAt: new Date().toISOString(), dryRun: false}, null, 2)}\n`,
    );
  }
  if (options.json) console.log(JSON.stringify(urlSummary, null, 2));
  process.exit(0);
}

const summary = {
  source: {path: options.source, commit: sourceCommit(options.source), sections: []},
  copied: 0,
  skipped: 0,
  bytesCopied: 0,
  bytesSkipped: 0,
  bySection: {},
};

for (const section of EXCLUDED_SECTIONS) {
  if (fs.existsSync(path.join(REPO, section))) {
    console.warn(
      `[content:fetch] WARN ${section}/ exists but is not part of this repository: ` +
        'it is ignored by the build; remove it (assets are served by ASSET_ORIGIN).',
    );
  }
}

for (const section of sections) {
  const from = path.join(options.source, section);
  if (!fs.existsSync(from)) {
    // `data/` is optional for a docs-only probe; the build needs it, so warn.
    console.warn(`[content:fetch] WARN missing section in source: ${section}`);
    continue;
  }
  const stats = {files: 0, copied: 0, skipped: 0, bytes: 0, bytesCopied: 0, bytesSkipped: 0};
  walk(from, (src, rel, kind) => {
    stats.files += 1;
    const dest = path.join(REPO, section, rel);
    const stat = kind === 'link' ? null : fs.statSync(src);
    const size = stat ? stat.size : 0;
    stats.bytes += size;

    let skip = false;
    if (!options.force && kind === 'file' && fs.existsSync(dest)) {
      const existing = fs.statSync(dest);
      skip = existing.isFile() && existing.size === size;
    }
    if (skip) {
      stats.skipped += 1;
      stats.bytesSkipped += size;
      return;
    }
    if (!options.dryRun) {
      ensureDir(path.dirname(dest));
      if (kind === 'link') {
        // Recreate the link instead of copying the target's bytes; content
        // trees are regular files today, this is only future-proofing.
        try {
          fs.rmSync(dest, {force: true});
        } catch {
          // Ignore: the copy below reports real failures.
        }
        fs.symlinkSync(fs.readlinkSync(src), dest);
      } else {
        fs.copyFileSync(src, dest);
        fs.chmodSync(dest, stat.mode & 0o777);
      }
    }
    stats.copied += 1;
    stats.bytesCopied += size;
  });

  summary.bySection[section] = stats;
  summary.copied += stats.copied;
  summary.skipped += stats.skipped;
  summary.bytesCopied += stats.bytesCopied;
  summary.bytesSkipped += stats.bytesSkipped;
}

if (!options.json) {
  console.log(`[content:fetch] source: ${options.source}`);
  if (summary.source.commit) console.log(`[content:fetch] source commit: ${summary.source.commit}`);
  for (const [section, stats] of Object.entries(summary.bySection)) {
    console.log(
      `[content:fetch] ${`${section}/`.padEnd(18)} ${String(stats.files).padStart(6)} files  ` +
        `${mib(stats.bytes).padStart(10)}  copied ${String(stats.copied).padStart(6)}  ` +
        `skipped ${String(stats.skipped).padStart(6)}`,
    );
  }
  console.log(
    `[content:fetch] total: copied ${summary.copied} files (${mib(summary.bytesCopied)}), ` +
      `skipped ${summary.skipped} (${mib(summary.bytesSkipped)})` +
      (options.dryRun ? ' [dry-run]' : ''),
  );
  console.log(
    `[content:fetch] note: ${EXCLUDED_SECTIONS.join(', ')} not fetched; ` +
      'assets are served by ASSET_ORIGIN (see guides/CI.md).',
  );
  console.log(
    '[content:fetch] note: this is a local stand-in for downloading the hub content release; ' +
      'production replaces it with `gh release download`.',
  );
}

if (!options.dryRun) {
  const outFile = path.join(REPO, '.content', 'fetch.json');
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(
    outFile,
    `${JSON.stringify({...summary, fetchedAt: new Date().toISOString(), dryRun: false}, null, 2)}\n`,
  );
}

if (options.json) console.log(JSON.stringify(summary, null, 2));
