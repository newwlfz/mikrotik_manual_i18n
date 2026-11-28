#!/usr/bin/env node
/**
 * `npm run bootstrap:from-release` — one-command locale skeleton bootstrap.
 *
 * Run it from inside the empty locale repository (or pass `--dir`). It downloads
 * the hub Release assets, verifies the archive and every file, expands the 11
 * template placeholders in contents *and* paths, re-verifies the result, and
 * moves the finished tree into the target directory. It only *prints* the git
 * init/add/commit/remote/push commands — it never commits, pushes, creates a
 * GitHub repository, changes credentials or touches the README's language
 * (the locale's own `translate:readme` workflow localizes the English skeleton).
 *
 * All per-site constants (baseUrl, site, site origin, hub repo/baseUrl, asset
 * origin) come from the Release `manifest.hub`: `baseUrl` and `site` are read
 * from a matching `hub.locales` entry when the locale is already registered,
 * otherwise derived from `--repo` and `hub.site_origin`. Only four values are
 * local arguments: `--locale`, `--label`, `--repo`, `--slug`.
 *
 * The `substitute()` / `substitutePath()` implementations below are the strict
 * ones from the hub's `tools/content/add-locale.mjs` (copied verbatim so this
 * tool also works standalone inside a scaffolded repo): an unknown or leftover
 * double-brace NAME token is fatal. GitHub Actions expressions (`${{ ... }}`)
 * and the one documented literal example in `tools/translate/readme.mjs` are
 * shielded before substitution and restored afterwards; JSX/JS lookalikes such
 * as `{{...}}` or `{{ runner.temp }}` never match the strict grammar either.
 * Files with no real placeholder must come out byte-identical.
 *
 * Usage (from the new, empty repository):
 *   node /path/to/hub/templates/locale-repo/tools/bootstrap/from-release.mjs \
 *     --locale zh-Hant --label 繁體中文 --repo newwlfz/mikrotik_manual_zh_hant \
 *     --slug zh_hant
 *
 * Options
 *   --locale <tag>    BCP 47 locale, e.g. zh-Hant (required)
 *   --label <text>    navbar label, e.g. 繁體中文 (default: the locale tag)
 *   --repo <owner/name>  repository that will build the site (required)
 *   --slug <slug>     file/repository slug, e.g. zh_hant (default: derived)
 *   --dir <path>      target directory (default: the current directory);
 *                     must not exist or must be empty
 *   --version <tag>   Release tag (default: skeleton-v0.1.0 or
 *                     $SKELETON_VERSION)
 *   --hub <owner/name> hub repository that hosts the Release
 *                     (default: newwlfz/mikrotik_manual_i18n)
 *   --asset-dir <dir> use local copies of `<tag>.tar.gz` and
 *                     `<tag>.manifest.json` instead of downloading (offline
 *                     rehearsal / fixture testing only)
 *   --dry-run         download, verify and print the plan; write no target
 *   -h, --help        print this help
 *
 * Failure is fail-closed: a checksum mismatch, unknown placeholder, leftover
 * placeholder, key-value mismatch or a non-empty target aborts before the
 * target is touched, and the temporary staging tree is removed.
 *
 * Exit codes: 0 success (or dry run), 1 validation/runtime failure, 2 bad usage.
 */

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_VERSION = process.env.SKELETON_VERSION || 'skeleton-v0.1.0';
const DEFAULT_HUB = 'newwlfz/mikrotik_manual_i18n';
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const SLUG_PATTERN = /^[a-z0-9_]+$/;
const SHA256_RE = /^[0-9a-fA-F]{64}$/;
/** Built by concatenation so the tool's own source has no stray token. */
const LOOKALIKE_LITERALS = ['{{' + 'PLACEHOLDER' + '}}'];
/** Strict real-placeholder matcher (no stateful `lastIndex`). */
const PLACEHOLDER = /\{\{[A-Za-z0-9_]+\}\}/;
/** GitHub Actions expressions are data here, never template placeholders. */
const GH_EXPR_RE = /\$\{\{[\s\S]*?\}\}/g;
/** The 11 names documented by `add-locale.mjs` and listed in the manifest. */
const NAMES = [
  'LOCALE', 'LOCALE_LABEL', 'SLUG', 'REPO', 'BASE_URL', 'SITE',
  'SITE_ORIGIN', 'HUB_REPO', 'HUB_BASE_URL', 'ASSET_ORIGIN', 'LOCALE_ENV',
];
/** Legacy localized README overrides from the retired per-tag policy. */
const README_OVERRIDE_RE = /^README\.[^/]+\.md$/;
/** Paths that must never appear in a scaffolded repository. */
const FORBIDDEN_PATH_RE = /(?:^|\/)(?:\.git|node_modules)(?:\/|$)|^(?:build|\.docusaurus)(?:\/|$)/;

const KNOWN_OPTIONS = new Map([
  ['locale', 'locale'],
  ['label', 'label'],
  ['repo', 'repo'],
  ['slug', 'slug'],
  ['dir', 'dir'],
  ['version', 'version'],
  ['hub', 'hub'],
  ['asset-dir', 'assetDir'],
]);

const USAGE = `Usage: bootstrap:from-release --locale <tag> --repo <owner/name> [options]

Download a verified locale skeleton from the hub Release and render it into
the current (empty) directory. No commit, no push, no credential writes.

Required
  --locale <tag>       BCP 47 locale, e.g. zh-Hant
  --repo <owner/name>  repository that will host the translated site

Optional
  --label <text>       display label (default: the locale tag)
  --slug <slug>        file/repository slug (default: locale with '-' -> '_')
  --dir <path>         target directory (default: cwd); must be empty/new
  --version <tag>      Release tag (default: ${DEFAULT_VERSION})
  --hub <owner/name>   host repository (default: ${DEFAULT_HUB})
  --asset-dir <dir>    read local Release assets instead of downloading
  --dry-run            verify and plan only; write nothing to the target
  -h, --help           print this help
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = {dryRun: false, help: false, values: {}};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument "${arg}"`);
    const separator = arg.indexOf('=');
    const name = separator === -1 ? arg.slice(2) : arg.slice(2, separator);
    let value = separator === -1 ? null : arg.slice(separator + 1);
    if (!KNOWN_OPTIONS.has(name)) throw new UsageError(`unknown option "--${name}"`);
    if (value === null) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} needs a value`);
      index += 1;
    }
    const key = KNOWN_OPTIONS.get(name);
    if (opts.values[key] !== undefined) throw new UsageError(`--${name} given twice`);
    opts.values[key] = value.trim();
  }
  return opts;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

/** Replace a double-brace token in `text`; unknown/unexpanded names are fatal. */
function substitute(text, values, where) {
  const replaced = text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new Error(`template ${where} uses the unknown placeholder ${match}`);
    }
    return String(values[name]);
  });
  const leftover = PLACEHOLDER.exec(replaced);
  if (leftover) {
    throw new Error(`template ${where} left the placeholder ${leftover[0]} unexpanded`);
  }
  return replaced;
}

/** Placeholders also appear in path segments (`i18n/{{LOCALE}}/.gitkeep`). */
function substitutePath(relativePath, values) {
  return relativePath
    .split(path.sep)
    .map((segment) => substitute(segment, values, relativePath))
    .join(path.sep);
}

/** Shield non-template lookalikes before the strict substitution. */
function shieldLiterals(text) {
  const saved = [];
  const shield = (match) => {
    const token = `@@BOOTSTRAP_LITERAL_${saved.length}@@`;
    if (text.includes(token)) throw new Error('cannot shield a literal lookalike safely');
    saved.push(match);
    return token;
  };
  let shielded = text.replace(GH_EXPR_RE, shield);
  for (const literal of LOOKALIKE_LITERALS) {
    if (shielded.includes(literal)) shielded = shielded.split(literal).join(shield(literal));
  }
  return {
    text: shielded,
    restore: (rendered) => {
      let result = rendered;
      saved.forEach((original, index) => {
        const token = `@@BOOTSTRAP_LITERAL_${index}@@`;
        if (!result.includes(token)) throw new Error(`lost a shielded literal: ${token}`);
        result = result.split(token).join(original);
      });
      return result;
    },
  };
}

/** Leftover check that ignores shielded lookalikes and `${{ ... }}` expressions. */
function hasLeftoverPlaceholder(text) {
  let stripped = text.replace(GH_EXPR_RE, '');
  for (const literal of LOOKALIKE_LITERALS) stripped = stripped.split(literal).join('');
  return PLACEHOLDER.test(stripped);
}

/** Every regular file under `dir`, relative to it. Symlinks are refused. */
function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full));
    else throw new Error(`unsupported archive entry ${path.relative(base, full)}: not a regular file`);
  }
  return out.sort();
}

function normalizeTarEntry(entry) {
  return entry.replace(/^\.\//, '').replace(/\/$/, '');
}

function checkManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest is not a JSON object');
  }
  const archive = manifest.archive;
  if (!archive || typeof archive.name !== 'string' || !archive.name || !SHA256_RE.test(archive.sha256 || '')) {
    throw new Error('manifest.archive must carry a name and a sha256');
  }
  if (path.basename(archive.name) !== archive.name || !archive.name.endsWith('.tar.gz')) {
    throw new Error(`manifest.archive.name is not a plain tar.gz asset name: ${archive.name}`);
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('manifest.files is empty');
  }
  const seen = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !SHA256_RE.test(file.sha256 || '')) {
      throw new Error('manifest.files contains an entry without path/sha256');
    }
    if (path.isAbsolute(file.path) || file.path.split('/').includes('..')) {
      throw new Error(`unsafe path in manifest.files: ${file.path}`);
    }
    if (seen.has(file.path)) throw new Error(`duplicate path in manifest.files: ${file.path}`);
    seen.add(file.path);
    if (FORBIDDEN_PATH_RE.test(file.path)) {
      throw new Error(`build/VCS artifact in manifest.files: ${file.path}`);
    }
  }
  const hub = manifest.hub;
  if (!hub || !REPO_PATTERN.test(hub.repo || '') || !hub.base_url || !hub.site || !hub.asset_origin) {
    throw new Error('manifest.hub must carry repo, base_url, site and asset_origin');
  }
  if (!Array.isArray(manifest.placeholders) || manifest.placeholders.length !== NAMES.length) {
    throw new Error(`manifest.placeholders must list ${NAMES.length} names`);
  }
  const names = manifest.placeholders.map((item) => item && item.name).sort();
  if (JSON.stringify(names) !== JSON.stringify([...NAMES].sort())) {
    throw new Error('manifest.placeholders does not list the expected 11 names');
  }
  return archive;
}

async function fetchAsset(url, label) {
  let response;
  try {
    response = await fetch(url, {redirect: 'follow'});
  } catch (error) {
    throw new Error(`could not download ${label} from ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`download ${label} failed (HTTP ${response.status}) from ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The manifest first: it names the archive and supplies every hub constant. */
async function loadAssets({hub, version, assetDir}) {
  const reference = assetDir
    ? `${assetDir}/${version}.manifest.json`
    : `https://github.com/${hub}/releases/download/${version}/${version}.manifest.json`;
  let manifestBytes, manifest;
  try {
    manifestBytes = assetDir
      ? fs.readFileSync(reference)
      : await fetchAsset(reference, 'manifest');
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`cannot read manifest ${reference}: ${error.message}`);
  }
  const archiveMeta = checkManifest(manifest);
  const archiveRef = assetDir
    ? path.join(assetDir, archiveMeta.name)
    : `https://github.com/${hub}/releases/download/${version}/${archiveMeta.name}`;
  const archiveBytes = assetDir ? fs.readFileSync(archiveRef) : await fetchAsset(archiveRef, 'archive');
  const actual = sha256(archiveBytes);
  if (actual !== archiveMeta.sha256.toLowerCase()) {
    throw new Error(
      `archive.sha256 mismatch: manifest has ${archiveMeta.sha256}, downloaded bytes have ${actual}`,
    );
  }
  return {manifest, manifestSha256: sha256(manifestBytes), archiveBytes, archiveSha256: actual, archiveRef};
}

/** Extract into `sourceDir` and verify the tar listing against the manifest. */
function unpackAndVerify(archiveBytes, manifest, sourceDir, archiveFile) {
  fs.writeFileSync(archiveFile, archiveBytes);
  const listing = spawnSync('tar', ['-tzf', archiveFile], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (listing.error || listing.status !== 0) {
    throw new Error(`tar -tzf failed: ${(listing.error || listing.stderr || '').toString().trim()}`);
  }
  const raw = listing.stdout.split('\n').filter(Boolean);
  const files = raw.filter((entry) => !entry.endsWith('/')).map(normalizeTarEntry);
  const expected = manifest.files.map((file) => file.path).sort();
  const missing = expected.filter((rel) => !files.includes(rel));
  const extra = files.filter((rel) => !expected.includes(rel));
  const unsafe = files.filter((rel) => path.isAbsolute(rel) || rel.split('/').includes('..'));
  if (missing.length || extra.length || unsafe.length) {
    throw new Error(
      `tar listing disagrees with manifest: missing=${missing.length} extra=${extra.length} unsafe=${unsafe.length}`,
    );
  }
  if (Number.isInteger(manifest.archive.file_count) && manifest.archive.file_count !== files.length) {
    throw new Error(`archive.file_count ${manifest.archive.file_count} != listed files ${files.length}`);
  }
  fs.mkdirSync(sourceDir, {recursive: true});
  const extract = spawnSync('tar', ['-xzf', archiveFile, '-C', sourceDir], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (extract.error || extract.status !== 0) {
    throw new Error(`tar -xzf failed: ${(extract.error || extract.stderr || '').toString().trim()}`);
  }

  const contents = new Map();
  const badHashes = [];
  for (const file of manifest.files) {
    const buffer = fs.readFileSync(path.join(sourceDir, file.path));
    const digest = sha256(buffer);
    contents.set(file.path, buffer);
    if (digest !== file.sha256.toLowerCase()) badHashes.push(file.path);
  }
  if (badHashes.length) {
    throw new Error(`${badHashes.length} file SHA-256 mismatch(es), e.g. ${badHashes[0]}`);
  }
  return {contents, fileCount: files.length};
}

/** All substitution values; only locale/label/repo/slug are local arguments. */
function buildValues(manifest, {locale, label, repo, slug}) {
  const hub = manifest.hub;
  const owner = repo.split('/')[0];
  const repoName = repo.split('/')[1];
  const registered = (manifest.hub.locales || []).find(
    (entry) => entry && (entry.code === locale || entry.repo === repo),
  );
  let baseUrl = registered && registered.base_url ? registered.base_url : `/${repoName}/`;
  if (!baseUrl.startsWith('/') || !baseUrl.endsWith('/')) {
    throw new Error(`baseUrl "${baseUrl}" (from manifest.hub) must start and end with "/"`);
  }
  const origin = registered && registered.site
    ? new URL(registered.site).origin
    : owner.toLowerCase() === hub.repo.split('/')[0].toLowerCase()
      ? new URL(hub.site).origin
      : `https://${owner.toLowerCase()}.github.io`;
  const site = registered && registered.site ? registered.site : `${origin}${baseUrl}`;
  let parsed;
  try {
    parsed = new URL(site);
  } catch {
    throw new Error(`site "${site}" (from manifest.hub) is not an absolute URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`site "${site}" must be http(s)`);
  }
  if (!parsed.pathname.endsWith('/')) parsed.pathname = `${parsed.pathname}/`;
  if (!parsed.pathname.endsWith(baseUrl)) {
    throw new Error(`site "${site}" does not end with baseUrl "${baseUrl}"`);
  }
  const values = {
    LOCALE: locale,
    LOCALE_LABEL: label,
    SLUG: slug,
    REPO: repo,
    BASE_URL: baseUrl,
    SITE: site,
    SITE_ORIGIN: parsed.origin,
    HUB_REPO: hub.repo,
    HUB_BASE_URL: hub.base_url,
    ASSET_ORIGIN: hub.asset_origin.replace(/\/+$/, ''),
    LOCALE_ENV: locale.split('-')[0].toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
  };
  for (const name of NAMES) {
    if (!values[name] || /\s/.test(String(values[name]))) {
      throw new Error(`placeholder ${name} has an empty or whitespace-containing value`);
    }
  }
  // Cross-check hub-owned values against the manifest placeholder metadata.
  for (const item of manifest.placeholders) {
    if (item.hub_value !== undefined && String(item.hub_value) !== String(values[item.name])) {
      throw new Error(
        `manifest.hub disagrees with placeholder ${item.name}: ${item.hub_value} != ${values[item.name]}`,
      );
    }
  }
  return values;
}

/** Strict render into `renderDir`; returns counts and skipped legacy files. */
function render(manifest, contents, values, renderDir) {
  const skipped = [];
  let lookalikeFilesUnchanged = 0;
  for (const file of [...manifest.files].sort((a, b) => a.path.localeCompare(b.path))) {
    const rel = file.path;
    if (README_OVERRIDE_RE.test(rel)) {
      // D9: the template ships one shared English README.md only. A stale
      // Release may still carry per-tag overrides; never scaffold them.
      skipped.push(rel);
      continue;
    }
    const source = contents.get(rel);
    const destination = path.join(renderDir, substitutePath(rel, values));
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    if (source.includes(0)) {
      fs.writeFileSync(destination, source);
      continue;
    }
    const text = source.toString('utf8');
    let rendered;
    try {
      const shielded = shieldLiterals(text);
      rendered = shielded.restore(substitute(shielded.text, values, rel));
    } catch (error) {
      throw new Error(`${rel}: ${error.message}`);
    }
    if (hasLeftoverPlaceholder(rendered)) {
      throw new Error(`${rel} still has an unexpanded placeholder after rendering`);
    }
    fs.writeFileSync(destination, rendered);
    if (!hasLeftoverPlaceholder(text)) {
      if (text !== rendered) {
        throw new Error(`${rel} has no real placeholder but changed during rendering`);
      }
      lookalikeFilesUnchanged += 1;
    }
  }
  return {skipped, lookalikeFilesUnchanged};
}

/** Post-render assertions: zero leftovers, key values, no stray artifacts. */
function verifyRender(renderDir, values, locale) {
  const paths = walkFiles(renderDir).map((rel) => rel.split(path.sep).join('/'));
  const leftovers = [];
  for (const rel of paths) {
    if (PLACEHOLDER.test(rel)) leftovers.push(`${rel} (path)`);
    if (FORBIDDEN_PATH_RE.test(rel)) throw new Error(`forbidden artifact in rendered tree: ${rel}`);
    const buffer = fs.readFileSync(path.join(renderDir, rel));
    if (!buffer.includes(0) && hasLeftoverPlaceholder(buffer.toString('utf8'))) {
      leftovers.push(`${rel} (content)`);
    }
  }
  if (leftovers.length) {
    throw new Error(`${leftovers.length} placeholder leftover(s): ${leftovers.slice(0, 5).join(', ')}`);
  }
  const gitkeep = `i18n/${locale}/.gitkeep`;
  if (!paths.includes(gitkeep)) throw new Error(`missing expanded path segment ${gitkeep}`);
  if (paths.some((rel) => rel.startsWith('i18n/{{'))) throw new Error('unexpanded i18n path segment');
  if (paths.some((rel) => README_OVERRIDE_RE.test(rel))) {
    throw new Error('a localized README override was scaffolded (only README.md is allowed)');
  }

  const expected = [
    ['README.md', values.LOCALE_LABEL, 'label'],
    ['README.md', values.LOCALE, 'locale'],
    ['README.md', values.REPO, 'repo'],
    ['README.md', values.HUB_REPO, 'hub repo'],
    ['README.md', values.SITE, 'site'],
    ['README.md', values.BASE_URL, 'baseUrl'],
    ['README.md', values.ASSET_ORIGIN, 'assetOrigin'],
    ['README.md', values.LOCALE_ENV, 'localeEnv'],
    ['.github/workflows/pages.yml', values.SLUG, 'slug'],
    ['.github/workflows/pages.yml', values.LOCALE, 'locale (workflow)'],
    ['.github/workflows/pages.yml', values.BASE_URL, 'baseUrl (workflow)'],
  ];
  for (const [rel, needle, what] of expected) {
    const full = path.join(renderDir, rel);
    if (!fs.existsSync(full)) throw new Error(`key file is missing: ${rel}`);
    if (!fs.readFileSync(full, 'utf8').includes(String(needle))) {
      throw new Error(`${rel} does not contain the expanded ${what}: ${needle}`);
    }
  }
  return paths.length;
}

function checkTarget(target) {
  if (!target || target === path.dirname(target)) throw new Error('invalid target directory');
  if (!fs.existsSync(target)) return;
  if (!fs.statSync(target).isDirectory()) throw new Error(`target exists and is not a directory: ${target}`);
  if (fs.readdirSync(target).length) throw new Error(`target directory is not empty: ${target}`);
}

function printPlan({assets, values, target, fileCount, skipped, lookalikeFilesUnchanged, dryRun}) {
  console.log('[bootstrap] source      ' + assets.archiveRef);
  console.log(`[bootstrap] archive     sha256=${assets.archiveSha256} (${formatSize(assets.archiveBytes.length)})`);
  console.log(`[bootstrap] manifest    sha256=${assets.manifestSha256}`);
  console.log(`[bootstrap] hub         ${values.HUB_REPO} ${values.HUB_BASE_URL} (asset origin ${values.ASSET_ORIGIN})`);
  for (const name of NAMES) console.log(`[bootstrap] ${name.padEnd(13)} ${values[name]}`);
  console.log(`[bootstrap] files       ${fileCount} (0 placeholders; ${lookalikeFilesUnchanged} lookalike file(s) unchanged)`);
  if (skipped.length) {
    console.log(`[bootstrap] skipped     ${skipped.length} legacy README override(s): ${skipped.join(', ')}`);
  }
  console.log(`[bootstrap] target      ${target}${dryRun ? ' (dry run — nothing written)' : ''}`);
}

function printCommands(target, repo) {
  console.log('\n[bootstrap] next commands (copy/paste; this script made no commit and no push):');
  console.log([
    `cd ${target}`,
    'git init -b main',
    'git add -A',
    'git commit -m "init: locale skeleton"',
    `git remote add origin https://github.com/${repo}.git`,
    'git push -u origin main',
  ].map((line) => `  ${line}`).join('\n'));
}

async function run(opts) {
  const {values: args, dryRun} = opts;
  const locale = args.locale;
  if (!locale) throw new UsageError('--locale is required (a BCP 47 tag, e.g. zh-Hant)');
  if (!LOCALE_PATTERN.test(locale)) throw new UsageError(`--locale "${locale}" is not a valid BCP 47 tag`);
  try {
    new Intl.Locale(locale);
  } catch {
    throw new UsageError(`--locale "${locale}" is not a valid BCP 47 language tag`);
  }
  const label = args.label || locale;
  if (!label.trim()) throw new UsageError('--label must not be empty');
  const repo = args.repo;
  if (!repo || !REPO_PATTERN.test(repo) || repo.includes('..')) {
    throw new UsageError('--repo must look like "owner/name"');
  }
  const slug = args.slug || locale.toLowerCase().replace(/-/g, '_');
  if (!SLUG_PATTERN.test(slug)) throw new UsageError(`--slug "${slug}" must contain only a-z, 0-9 and _`);
  const hub = args.hub || DEFAULT_HUB;
  const version = args.version || DEFAULT_VERSION;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) {
    throw new UsageError(`--version "${version}" is unsafe for an asset name`);
  }
  const target = path.resolve(args.dir || process.cwd());
  checkTarget(target);

  const parent = dryRun ? os.tmpdir() : path.dirname(target);
  fs.mkdirSync(parent, {recursive: true});
  const staging = fs.mkdtempSync(path.join(parent, `.bootstrap-${slug}-`));
  try {
    const assets = await loadAssets({hub, version, assetDir: args.assetDir});
    const values = buildValues(assets.manifest, {locale, label, repo, slug});
    const sourceDir = path.join(staging, 'source');
    const {contents, fileCount} = unpackAndVerify(
      assets.archiveBytes, assets.manifest, sourceDir, path.join(staging, 'asset.tar.gz'),
    );
    const renderDir = path.join(staging, 'render');
    fs.mkdirSync(renderDir, {recursive: true});
    const {skipped, lookalikeFilesUnchanged} = render(assets.manifest, contents, values, renderDir);
    const renderedFiles = verifyRender(renderDir, values, locale);
    if (renderedFiles !== fileCount - skipped.length) {
      throw new Error(`rendered ${renderedFiles} files, expected ${fileCount - skipped.length}`);
    }
    printPlan({assets, values, target, fileCount: renderedFiles, skipped, lookalikeFilesUnchanged, dryRun});
    if (dryRun) {
      console.log('[bootstrap] dry run — target untouched');
      printCommands(target, repo);
      return 0;
    }

    // Atomic as far as the filesystem allows: the checked, rendered tree is
    // renamed into place; the target is removed only after every check passed.
    if (fs.existsSync(target)) fs.rmSync(target, {recursive: true, force: true});
    fs.renameSync(renderDir, target);
    console.log(`[bootstrap] wrote ${renderedFiles} files to ${target}`);
    printCommands(target, repo);
    return 0;
  } finally {
    fs.rmSync(staging, {recursive: true, force: true});
  }
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`[bootstrap] ERROR ${error.message}\n`);
    console.error(USAGE);
    return 2;
  }
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  try {
    return await run(opts);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[bootstrap] ERROR ${error.message}\n`);
      console.error(USAGE);
      return 2;
    }
    console.error(`[bootstrap] ERROR ${error.message}`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
