#!/usr/bin/env node
/**
 * `node tools/content/release-skeleton.mjs` — build a Release-ready locale
 * repository skeleton from `templates/locale-repo/`.
 *
 * Why the *worktree*: the template is the canonical copy of the locale
 * toolchain, while this hub's HEAD still carries an older (221-file) snapshot.
 * Packaging HEAD would ship the old skeleton, so the archive is always made
 * from the working tree (241 files at the time of writing) — i.e. from exactly
 * the tree that has been reviewed/committed when CI runs on a tag.
 *
 * Pipeline
 *   1. walk the template worktree (regular files/directories only);
 *   2. refuse secret-shaped paths *before any byte is read* — in particular
 *      `.env.local` is never opened; only the allow-listed `*.env*.example`
 *      files are hashed and archived;
 *   3. assert the required scaffold files/sections (`--check-required`);
 *   4. read `locales.json` / `versions.json` for the hub constants;
 *   5. stage a byte-for-byte copy under `$RUNNER_TEMP` (or `--out-dir`) and run
 *      `tar -C <stage> -czf <archive> .` — the trailing `.` keeps dotfiles and
 *      the literal `i18n/{{LOCALE}}/.gitkeep` path segment;
 *   6. read the tar back and verify dotfiles, the placeholder directory and
 *      the file count; write `manifest.json` and `$GITHUB_OUTPUT`
 *      (`asset`, `manifest`, `version`).
 *
 * The 11 placeholders are **not** substituted here: the Release ships the
 * unexpanded skeleton and `tools/content/add-locale.mjs` is the consumer that
 * fills them in. Six files use a literal `{{` as a JSX/JS expression; they are
 * deliberately left untouched and counted separately in the manifest.
 *
 * Modes
 *   --check-required   assertions only; exit 1 if any required item is missing.
 *   --dry-run          full analysis, no staging/tar/manifest/output writes.
 *                      Required items are reported but do not fail the run.
 *   (default)          build the archive + manifest + GITHUB_OUTPUT.
 *
 * Usage
 *   node tools/content/release-skeleton.mjs --check-required
 *   node tools/content/release-skeleton.mjs --dry-run
 *   node tools/content/release-skeleton.mjs --version skeleton-v0.1.0
 *   node tools/content/release-skeleton.mjs --out-dir /tmp/release-skeleton
 *
 * Exit codes: 0 success, 1 validation/runtime failure, 2 bad usage.
 */

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import YAML from 'yaml';

import localeRegistry from './locales.js';

/** Hub checkout (this file lives in `tools/content/`). */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE_DIR = path.join(REPO, 'templates/locale-repo');
const REGISTRY_FILE = path.join(REPO, 'locales.json');
const VERSIONS_FILE = path.join(REPO, 'versions.json');
const TEMPLATE_REL = 'templates/locale-repo';

/** The 11 template placeholders, in the order documented by `add-locale.mjs`. */
const PLACEHOLDERS = [
  {name: 'LOCALE', source: 'per-locale', note: 'BCP 47 tag, e.g. zh-Hans'},
  {name: 'LOCALE_LABEL', source: 'per-locale', note: 'navbar label, e.g. 简体中文'},
  {name: 'SLUG', source: 'derived', note: 'file/repository slug, e.g. zh_hans'},
  {name: 'REPO', source: 'per-locale', note: 'owner/name of the locale repository'},
  {name: 'BASE_URL', source: 'per-locale', note: 'path prefix, starts and ends with /'},
  {name: 'SITE', source: 'per-locale', note: 'absolute site address (origin + baseUrl)'},
  {name: 'SITE_ORIGIN', source: 'derived', note: 'origin of SITE'},
  {name: 'HUB_REPO', source: 'hub', note: "hub's owner/name from locales.json"},
  {name: 'HUB_BASE_URL', source: 'hub', note: "hub's baseUrl from locales.json"},
  {name: 'ASSET_ORIGIN', source: 'hub', note: "hub's site without a trailing slash"},
  {name: 'LOCALE_ENV', source: 'derived', note: 'environment-variable prefix, e.g. ZH'},
];
/** Non-global matcher for a real placeholder (no stateful `lastIndex`). */
const PLACEHOLDER_RE = /\{\{(?:LOCALE|LOCALE_LABEL|SLUG|REPO|BASE_URL|SITE|SITE_ORIGIN|HUB_REPO|HUB_BASE_URL|ASSET_ORIGIN|LOCALE_ENV)\}\}/;

/**
 * Required scaffold items. The six tool files, the two YAML sections and the
 * zh-Hans profile are being landed by a parallel change; this list reserves the
 * assertions now. Missing items are **reported**, never repaired here.
 */
const REQUIRED = [
  {path: 'README.md'},
  {path: '.gitignore'},
  {path: '.gitattributes'},
  {path: '.env.local.example'},
  {path: 'package.json'},
  {path: 'docusaurus.config.ts'},
  {path: 'sidebars.ts'},
  {path: 'versions.json'},
  {path: 'i18n/{{LOCALE}}/.gitkeep', label: 'placeholder path segment'},
  {path: 'tools/bootstrap/from-release.mjs', verify: verifyBootstrapScript},
  {path: 'tools/verify/tag-rows.mjs'},
  {path: 'tools/translate/lib/checkpoint.mjs'},
  {path: 'tools/verify/checkpoint.mjs'},
  {path: 'tools/sync/lib/render-page.mjs'},
  {path: 'tools/sync/fetch-blog.mjs'},
  {path: 'tools/verify/changelog-tags.mjs'},
  {path: 'config/locale-profiles/zh-Hans.md'},
  {path: 'config/sidebar-labels.yml', verify: verifySidebarLabels},
  {path: 'config/known-translations.yml', verify: verifyKnownTranslations},
];

const USAGE = `Usage: node tools/content/release-skeleton.mjs [options]

Build a locale-skeleton tar.gz + manifest.json from templates/locale-repo/
(the worktree — HEAD is an older snapshot).

Options
  --version <v>     skeleton version / release tag (default: $SKELETON_VERSION,
                    $GITHUB_REF_NAME, or skeleton-dev-<date>)
  --out-dir <dir>   staging/output directory (default: $RUNNER_TEMP/releases/
                    release-skeleton, or the OS temp dir locally)
  --check-required  report the required-file assertions only (exit 1 on missing)
  --dry-run         analyse and print the plan; write nothing
  -h, --help        print this help

Outputs (real run): $GITHUB_OUTPUT gets asset=, manifest=, version=.
`;

class UsageError extends Error {}
class SkeletonError extends Error {}

function parseArgs(argv) {
  const opts = {version: null, outDir: null, checkRequired: false, dryRun: false, help: false};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--check-required') {
      opts.checkRequired = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--version' || arg === '--out-dir') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`${arg} needs a value`);
      }
      opts[arg === '--version' ? 'version' : 'outDir'] = value.trim();
      i += 1;
    } else {
      throw new UsageError(`unexpected argument "${arg}"`);
    }
  }
  if (opts.checkRequired && opts.dryRun) {
    throw new UsageError('--check-required and --dry-run are separate modes');
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

/** Every regular file under `dir`, as sorted POSIX-style relative paths. */
function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, base, out);
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    } else {
      throw new SkeletonError(
        `unsupported template entry ${path.relative(base, full)}: only regular files ` +
          'and directories can be archived',
      );
    }
  }
  return out.sort();
}

/**
 * Path-based secret guard. Deliberately runs before any file is read: a real
 * `.env.local` must abort the build without having its contents inspected.
 */
const SAFE_ENV_EXAMPLE = /^\.env(?:\.[A-Za-z0-9_-]+)*\.example$/i;
const ENV_SECRET = /^\.env(?:\..*)?$/i;

function sensitiveReason(rel) {
  const segments = rel.split('/');
  if (segments.includes('.git') || segments.includes('node_modules')) {
    return 'VCS/generated directory must not be shipped';
  }
  const base = segments[segments.length - 1];
  if (SAFE_ENV_EXAMPLE.test(base)) return null;
  if (ENV_SECRET.test(base)) return 'environment/secret file (only *.example is allowed)';
  if (/\.(?:pem|p12|pfx|key|crt)$/i.test(base)) return 'private key / certificate';
  if (/^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)/i.test(base)) return 'SSH private key';
  if (/(?:^|[._-])(?:token|secret|credential|password|passwd)(?:[._-]|$)/i.test(base)) {
    return 'credential-named file';
  }
  return null;
}

function checkSensitive(files) {
  const findings = [];
  for (const rel of files) {
    const reason = sensitiveReason(rel);
    if (reason) findings.push({path: rel, reason});
  }
  return findings;
}

function readYaml(rel) {
  const full = path.join(TEMPLATE_DIR, rel);
  if (!fs.existsSync(full)) throw new SkeletonError(`${rel} is missing`);
  try {
    return YAML.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    throw new SkeletonError(`${rel} is not valid YAML: ${error.message}`);
  }
}

/** `config/sidebar-labels.yml` must carry the locale-aware `locales:` map. */
function verifySidebarLabels() {
  const doc = readYaml('config/sidebar-labels.yml');
  const locales = doc && doc.locales;
  if (!locales || typeof locales !== 'object' || Array.isArray(locales) || !Object.keys(locales).length) {
    return 'no non-empty top-level "locales:" mapping';
  }
  return null;
}

/** `config/known-translations.yml` must keep a locale-shaped empty shell. */
function verifyKnownTranslations() {
  const doc = readYaml('config/known-translations.yml');
  if (!doc || !Object.prototype.hasOwnProperty.call(doc, '{{LOCALE}}')) {
    return 'no "{{LOCALE}}:" top-level key';
  }
  const rules = doc['{{LOCALE}}'];
  if (Array.isArray(rules) && rules.some((rule) => rule && (rule.from || rule.to))) {
    return '"{{LOCALE}}:" is not an empty shell (contains concrete from/to rules)';
  }
  return null;
}

/** The one-command bootstrap tool must be readable UTF-8 with legal tokens. */
function verifyBootstrapScript() {
  const rel = 'tools/bootstrap/from-release.mjs';
  const buffer = fs.readFileSync(path.join(TEMPLATE_DIR, rel));
  if (buffer.includes(0)) return 'binary file; the bootstrap tool must be UTF-8 text';
  const text = buffer.toString('utf8');
  if (!text.trim()) return 'empty file';
  const known = new Set(PLACEHOLDERS.map((p) => p.name));
  const unknown = new Set();
  for (const match of text.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) {
    if (!known.has(match[1])) unknown.add(match[0]);
  }
  if (unknown.size) return `unknown placeholder(s): ${[...unknown].join(', ')}`;
  if (!text.includes('function substitute(') || !text.includes('function substitutePath(')) {
    return 'missing the strict substitute/substitutePath helpers';
  }
  return null;
}

/** Report every required item; the report never modifies the template. */
function checkRequired(files) {
  const present = new Set(files);
  const items = REQUIRED.map((item) => {
    if (!present.has(item.path)) {
      return {path: item.path, status: 'missing', reason: 'file not present in the worktree'};
    }
    let reason = null;
    if (item.verify) {
      try {
        reason = item.verify();
      } catch (error) {
        reason = error.message;
      }
    }
    return {path: item.path, status: reason ? 'invalid' : 'ok', reason};
  });
  return {
    total: items.length,
    passed: items.filter((item) => item.status === 'ok').length,
    failures: items.filter((item) => item.status !== 'ok'),
    items,
  };
}

/** Hub constants. Values mirror `tools/content/add-locale.mjs`. */
function readHubConstants() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const hub = registry.locales && registry.locales[registry.default];
  if (!hub) throw new SkeletonError(`locales.json: default locale "${registry.default}" is missing`);
  const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
  if (!Array.isArray(versions) || versions.some((v) => typeof v !== 'string')) {
    throw new SkeletonError('versions.json: expected an array of version strings');
  }
  return {
    default_locale: registry.default,
    repo: hub.repo,
    base_url: hub.baseUrl,
    site: hub.site,
    site_origin: localeRegistry.siteOrigin(hub),
    asset_origin: localeRegistry.normalizeSiteUrl(hub.site),
    locales: Object.entries(registry.locales).map(([code, entry]) => ({
      code,
      label: entry.label,
      repo: entry.repo,
      base_url: entry.baseUrl,
      site: entry.site,
      available: entry.available === true,
    })),
    versions,
  };
}

/** Placeholder values that are already fixed by the hub (the rest are per-locale). */
function placeholderManifest(hub) {
  const fixed = {
    HUB_REPO: hub.repo,
    HUB_BASE_URL: hub.base_url,
    ASSET_ORIGIN: hub.asset_origin,
  };
  return PLACEHOLDERS.map((p) => ({
    name: p.name,
    source: p.source,
    note: p.note,
    ...(fixed[p.name] === undefined ? {} : {hub_value: fixed[p.name]}),
  }));
}

/** Count real placeholders (files + path segments) and JSX `{{` lookalikes. */
function placeholderStats(files, contents) {
  let filesWithPlaceholders = 0;
  let pathSegmentsWithPlaceholders = 0;
  let lookalikeFiles = 0;
  for (const rel of files) {
    const buffer = contents.get(rel);
    const text = buffer.includes(0) ? '' : buffer.toString('utf8');
    if (PLACEHOLDER_RE.test(text)) filesWithPlaceholders += 1;
    if (PLACEHOLDER_RE.test(rel)) pathSegmentsWithPlaceholders += 1;
    if (text.includes('{{') && !PLACEHOLDER_RE.test(text)) lookalikeFiles += 1;
  }
  return {filesWithPlaceholders, pathSegmentsWithPlaceholders, lookalikeFiles};
}

/** Hash every file. Only called after the secret-path guard passed. */
function hashFiles(files) {
  const contents = new Map();
  const entries = [];
  let totalBytes = 0;
  for (const rel of files) {
    const buffer = fs.readFileSync(path.join(TEMPLATE_DIR, rel));
    contents.set(rel, buffer);
    totalBytes += buffer.length;
    entries.push({path: rel, bytes: buffer.length, sha256: sha256(buffer)});
  }
  return {entries, contents, totalBytes};
}

function git(args) {
  const result = spawnSync('git', args, {cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (result.error || result.status !== 0) {
    throw new SkeletonError(`git ${args.join(' ')} failed: ${(result.error || result.stderr || '').toString().trim()}`);
  }
  return result.stdout;
}

/** Source identity: the commit plus the *worktree* status of the template. */
function sourceState() {
  let commit = null;
  let branch = null;
  let status = 'unknown';
  let dirtyPaths = [];
  let warning = null;
  try {
    commit = git(['rev-parse', 'HEAD']).trim();
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch (error) {
    warning = error.message;
  }
  try {
    const raw = git(['status', '--porcelain=v1', '-z', '--no-renames', '--', TEMPLATE_REL]);
    dirtyPaths = raw
      .split('\0')
      .filter(Boolean)
      .map((entry) => entry.slice(3).replace(/^templates\/locale-repo\//, ''))
      .sort();
    status = dirtyPaths.length ? 'dirty' : 'clean';
  } catch (error) {
    warning = `${warning ? `${warning}; ` : ''}${error.message}`;
  }
  return {
    kind: 'worktree',
    path: TEMPLATE_REL,
    commit,
    short_commit: commit ? commit.slice(0, 7) : null,
    branch,
    status,
    changed_file_count: dirtyPaths.length,
    changed_paths: dirtyPaths,
    ...(warning ? {warning} : {}),
  };
}

function resolveVersion(opts) {
  const candidate = opts.version || process.env.SKELETON_VERSION || process.env.GITHUB_REF_NAME || '';
  if (candidate) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidate)) {
      throw new UsageError(`--version "${candidate}" contains characters unsafe for an asset name`);
    }
    return candidate;
  }
  return `skeleton-dev-${new Date().toISOString().slice(0, 10)}`;
}

function resolveOutDir(opts) {
  if (opts.outDir) return path.resolve(opts.outDir);
  const base = process.env.RUNNER_TEMP || os.tmpdir();
  return path.join(base, 'release-skeleton');
}

/** Byte-for-byte stage copy, then the canonical tar command. */
function stageAndArchive(files, outDir, archive) {
  const stage = path.join(outDir, 'stage');
  fs.rmSync(stage, {recursive: true, force: true});
  fs.mkdirSync(stage, {recursive: true});
  for (const rel of files) {
    const src = path.join(TEMPLATE_DIR, rel);
    const dst = path.join(stage, rel);
    fs.mkdirSync(path.dirname(dst), {recursive: true});
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, fs.statSync(src).mode & 0o777);
  }
  const tar = spawnSync('tar', ['-C', stage, '-czf', archive, '.'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (tar.error || tar.status !== 0) {
    throw new SkeletonError(`tar failed: ${(tar.error || tar.stderr || '').toString().trim()}`);
  }
  return stage;
}

function normalizeTarEntry(entry) {
  return entry.replace(/^\.\//, '').replace(/\/$/, '');
}

/** Read the produced tar back and verify its contents against the worktree. */
function verifyArchive(files, archive) {
  const listing = spawnSync('tar', ['-tzf', archive], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (listing.error || listing.status !== 0) {
    throw new SkeletonError(`tar -tzf failed: ${(listing.error || listing.stderr || '').toString().trim()}`);
  }
  const raw = listing.stdout.split('\n').filter(Boolean);
  const dirEntries = new Set(raw.filter((e) => e.endsWith('/')).map(normalizeTarEntry));
  const listed = raw.filter((e) => !e.endsWith('/')).map(normalizeTarEntry).sort();
  const expected = [...files].sort();
  const missing = expected.filter((rel) => !listed.includes(rel));
  const extra = listed.filter((rel) => !expected.includes(rel));
  const dotfiles = [
    '.gitignore',
    '.gitattributes',
    '.env.local.example',
    'config/glossary/.gitkeep',
    'i18n/{{LOCALE}}/.gitkeep',
  ].filter((rel) => listed.includes(rel));
  const placeholderDir = dirEntries.has('i18n/{{LOCALE}}') || listed.includes('i18n/{{LOCALE}}/.gitkeep');
  const unsafe = listed.filter((rel) => sensitiveReason(rel) || path.isAbsolute(rel) || rel.startsWith('../'));
  return {
    status: !missing.length && !extra.length && dotfiles.length === 5 && placeholderDir && !unsafe.length
      ? 'pass'
      : 'fail',
    file_count: listed.length,
    expected_file_count: expected.length,
    dotfiles_present: dotfiles,
    placeholder_directory_present: placeholderDir,
    missing,
    extra,
    unsafe,
  };
}

function printRequiredReport(required) {
  console.log(`[release-skeleton] required    ${required.passed}/${required.total} OK`);
  for (const item of required.failures) {
    console.log(`[release-skeleton]   ${item.status.toUpperCase()} ${item.path} — ${item.reason}`);
  }
}

function printPlan({version, source, hub, files, totalBytes, stats, required, outDir, archive, manifestPath}) {
  console.log(`[release-skeleton] version     ${version}`);
  console.log(`[release-skeleton] source      ${TEMPLATE_REL} @ ${source.short_commit || 'unknown'} (${source.status})`);
  console.log(`[release-skeleton] files       ${files.length} (${formatSize(totalBytes)})`);
  console.log(
    `[release-skeleton] placeholders ${PLACEHOLDERS.length} names; ` +
      `${stats.filesWithPlaceholders} files + ${stats.pathSegmentsWithPlaceholders} path segment(s); ` +
      `${stats.lookalikeFiles} JSX '{{' lookalike file(s) left untouched`,
  );
  console.log(`[release-skeleton] hub         ${hub.repo} ${hub.base_url} (${hub.locales.length} locales, ${hub.versions.length} versions)`);
  printRequiredReport(required);
  console.log('[release-skeleton] sensitive   pass (path-based guard; .env.local never read)');
  console.log(`[release-skeleton] out-dir     ${outDir}`);
  console.log(`[release-skeleton] archive     ${archive} (not written in dry run)`);
  console.log(`[release-skeleton] manifest    ${manifestPath} (not written in dry run)`);
  console.log('[release-skeleton] outputs     not written in dry run');
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (!fs.existsSync(TEMPLATE_DIR) || !fs.statSync(TEMPLATE_DIR).isDirectory()) {
    throw new SkeletonError(`locale template is missing: ${TEMPLATE_REL}`);
  }

  const files = walkFiles(TEMPLATE_DIR);
  const sensitive = checkSensitive(files);
  if (sensitive.length) {
    throw new SkeletonError(
      `refusing to package ${sensitive.length} sensitive file(s) (no content was read):\n` +
        sensitive.map((f) => `  ${f.path} — ${f.reason}`).join('\n'),
    );
  }
  const required = checkRequired(files);

  if (opts.checkRequired) {
    printRequiredReport(required);
    console.log(`[release-skeleton] sensitive   pass (${files.length} path(s) checked)`);
    return required.failures.length ? 1 : 0;
  }

  const hub = readHubConstants();
  const version = resolveVersion(opts);
  const outDir = resolveOutDir(opts);
  const archive = path.join(outDir, `${version}.tar.gz`);
  const manifestPath = path.join(outDir, `${version}.manifest.json`);
  const {entries, contents, totalBytes} = hashFiles(files);
  const stats = placeholderStats(files, contents);
  const source = sourceState();

  if (opts.dryRun) {
    printPlan({version, source, hub, files, totalBytes, stats, required, outDir, archive, manifestPath});
    return 0;
  }

  fs.mkdirSync(outDir, {recursive: true});
  stageAndArchive(files, outDir, archive);
  const readback = verifyArchive(files, archive);
  const archiveBuffer = fs.readFileSync(archive);
  if (readback.status !== 'pass') {
    throw new SkeletonError(
      'tar readback failed: ' +
        JSON.stringify({missing: readback.missing, extra: readback.extra, unsafe: readback.unsafe}),
    );
  }

  const manifest = {
    skeleton_version: version,
    generated_at: new Date().toISOString(),
    source,
    hub,
    placeholders: placeholderManifest(hub),
    files: entries,
    checks: {
      required: {
        status: required.failures.length ? 'fail' : 'pass',
        total: required.total,
        passed: required.passed,
        failures: required.failures,
      },
      sensitive: {status: 'pass', forbidden_files: 0, note: 'path-based guard; .env.local was never read'},
      placeholders: {
        names: PLACEHOLDERS.length,
        files: stats.filesWithPlaceholders,
        path_segments: stats.pathSegmentsWithPlaceholders,
        jsx_lookalike_files: stats.lookalikeFiles,
      },
      tar_readback: readback,
    },
    archive: {
      name: path.basename(archive),
      bytes: archiveBuffer.length,
      sha256: sha256(archiveBuffer),
      file_count: readback.file_count,
      source_file_count: files.length,
      source_bytes: totalBytes,
      command: 'tar -C <stage> -czf <archive> .',
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(
      githubOutput,
      `asset=${archive}\nmanifest=${manifestPath}\nversion=${version}\n`,
    );
  }

  console.log(`[release-skeleton] version     ${version}`);
  console.log(`[release-skeleton] source      ${TEMPLATE_REL} @ ${source.short_commit || 'unknown'} (${source.status})`);
  console.log(`[release-skeleton] files       ${files.length} (${formatSize(totalBytes)})`);
  console.log(`[release-skeleton] required    ${required.passed}/${required.total} OK`);
  console.log(`[release-skeleton] sensitive   pass (0 forbidden; .env.local never read)`);
  console.log(`[release-skeleton] archive     ${archive} (${formatSize(archiveBuffer.length)} sha256=${manifest.archive.sha256})`);
  console.log(`[release-skeleton] readback    ${readback.status} (${readback.file_count} files, ${readback.dotfiles_present.length} dotfiles, placeholder dir=${readback.placeholder_directory_present})`);
  console.log(`[release-skeleton] manifest    ${manifestPath}`);
  console.log(`[release-skeleton] outputs     ${githubOutput ? `written to ${githubOutput}` : 'GITHUB_OUTPUT not set (local run)'}`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const label = error instanceof UsageError ? 'usage' : 'error';
  console.error(`[release-skeleton] ${label}: ${error.message}`);
  process.exitCode = error instanceof UsageError ? 2 : 1;
}
