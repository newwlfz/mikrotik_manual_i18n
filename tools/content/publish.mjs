#!/usr/bin/env node
/**
 * Publish the hub's English content to the language repositories.
 *
 * The hub (`mikrotik_manual_i18n`) owns the corrected English source and the
 * locale registry. Each language repository (`mikrotik_manual_zh_hans`, …)
 * owns its translation overlays (`i18n/`), its build configuration and its
 * deployment. This script is the only writer between them: it copies the
 * shared content roots and `locales.json` into each non-default locale's
 * repository and pushes one commit, which triggers that repository's
 * `pages.yml` (translate → build → deploy).
 *
 * What is published
 *   - every root in CONTENT_ROOTS: directories (`docs/`, `versioned_docs/`,
 *     `hardware/`, `blog/`, `changelog/`, `data/`, `versioned_sidebars/`)
 *     replace the destination tree of the same name, so destination-only files
 *     are deleted and a removed hub page disappears from the language site as
 *     well; single files (`sidebars.ts`, `sidebars-hardware.ts`,
 *     `versions.json`) are overwritten in place;
 *   - `locales.json`, byte for byte.
 *
 * What is never touched
 *   - the destination's `i18n/` (the translation overlays), `config/` (its
 *     per-site knobs), `work/` (its local caches), `tools/`, `src/`, `.github/`
 *     and everything else.
 *
 * Idempotent: `git status --porcelain` is checked after staging and an empty
 * result means "skip" — a scheduled run with no hub changes pushes nothing.
 *
 * Usage:
 *   node tools/content/publish.mjs [--dry-run] [--only=<locale>] [--message=<text>]
 *
 *   --dry-run        print the plan only; no clone, no commit, no push, and no
 *                    network access (the token is not needed)
 *   --only=<locale>  publish one non-default locale (repeatable)
 *   --message=<text> commit subject; `{sha}`/`{locale}`/`<hub-sha>` expand
 *                    (default: `content: sync from hub {sha}`)
 *
 * Environment:
 *   CROSS_REPO_TOKEN   fine-grained PAT with "Contents: read and write" on the
 *                      language repositories. Required for a real run, never
 *                      printed (all git output is redacted). CI reads it from
 *                      the hub repository's Actions secret of the same name.
 *   PUBLISH_GIT_NAME / PUBLISH_GIT_EMAIL
 *                      commit identity (defaults: mikrotik-manual-hub).
 *   GIT_AUTHOR_* / GIT_COMMITTER_* are honoured for the rest.
 *
 * Failures are isolated per locale: one repository failing to clone/commit/
 * push does not stop the others, and the process exits non-zero if any failed.
 */

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import localeRegistry from './locales.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/**
 * Content roots copied from the hub into each language repository.
 *
 * A language site builds the same routes as the hub, so every root its build
 * reads must arrive here. Entries are either directories (replaced wholesale)
 * or single files (overwritten):
 *
 *   docs/ versioned_docs/ hardware/ blog/ changelog/ data/
 *   sidebars.ts sidebars-hardware.ts versioned_sidebars/ versions.json
 *
 * `locales.json` is synced as well but kept separate (`REGISTRY_FILE`): it is
 * the locale registry, not content, and the dry run reports the ten content
 * roots on their own.
 *
 * Adding a root is a deliberate change: the destination build must tolerate a
 * replaced tree, and that repository must not `.gitignore` it (asserted before
 * the commit below).
 */
const CONTENT_ROOTS = [
  'docs',
  'versioned_docs',
  'hardware',
  'blog',
  'changelog',
  'data',
  'sidebars.ts',
  'sidebars-hardware.ts',
  'versioned_sidebars',
  'versions.json',
];
const REGISTRY_FILE = 'locales.json';
const TOKEN_ENV = 'CROSS_REPO_TOKEN';
const DEFAULT_MESSAGE = 'content: sync from hub {sha}';
const DEFAULT_GIT_NAME = 'mikrotik-manual-hub';
const DEFAULT_GIT_EMAIL = 'hub@users.noreply.github.com';

const gitName = (process.env.PUBLISH_GIT_NAME || '').trim() || DEFAULT_GIT_NAME;
const gitEmail = (process.env.PUBLISH_GIT_EMAIL || '').trim() || DEFAULT_GIT_EMAIL;

function log(message) {
  console.log(`[publish] ${message}`);
}

function warn(message) {
  console.error(`[publish] ${message}`);
}

/**
 * Remove every credential-shaped string from text before it reaches a log.
 *
 * Git echoes the remote URL in some failures, and the URL embeds the PAT. The
 * exact token is replaced first, then the generic userinfo patterns catch
 * encoded variants.
 */
function redact(value, token) {
  let text = String(value ?? '');
  if (token) {
    text = text.split(token).join('***');
    try {
      text = text.split(encodeURIComponent(token)).join('***');
    } catch {
      // encodeURIComponent cannot throw for a string, but never let redaction fail.
    }
  }
  return text
    .replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
    .replace(/(https?:\/\/)[^/@\s]+@github\.com/gi, '$1***@github.com');
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    only: [],
    message: null,
    help: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length).trim();
      if (!value) throw new Error('--only needs a locale, e.g. --only=zh-Hans');
      options.only.push(value);
    } else if (arg.startsWith('--message=')) {
      const value = arg.slice('--message='.length);
      if (!value.trim()) throw new Error('--message needs a non-empty commit subject');
      options.message = value;
    } else {
      throw new Error(`unknown argument: ${arg} (try --help)`);
    }
  }
  return options;
}

function usage() {
  return [
    'usage: node tools/content/publish.mjs [--dry-run] [--only=<locale>] [--message=<text>]',
    '',
    'Publish every content root plus locales.json from the hub to each',
    'non-default language repository, then commit and push. The push triggers',
    "that repository's workflow (translate -> build -> deploy).",
    '',
    `content roots: ${CONTENT_ROOTS.join(', ')}`,
    '',
    '  --dry-run        print the plan; no network, no clone, no commit, no push',
    '  --only=<locale>  publish one non-default locale (repeatable)',
    '  --message=<text> commit subject; {sha}/{locale}/<hub-sha> expand',
    '',
    `  ${TOKEN_ENV}      fine-grained PAT with "Contents: read and write" on the`,
    '                   language repositories (required unless --dry-run)',
    '',
    'Examples:',
    '  node tools/content/publish.mjs --dry-run',
    '  node tools/content/publish.mjs --only=zh-Hans',
    '  node tools/content/publish.mjs --message="content: sync 7.26 fixes"',
  ].join('\n');
}

/** Run git, capturing output; failures are sanitised and carry no URL. */
function git(args, {label = 'git', cwd = REPO, token = ''} = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      // Never block on a credential prompt in CI or locally without a TTY.
      GIT_ASKPASS: 'echo',
    },
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${redact(result.error.message, token)}`);
  }
  if (result.status !== 0) {
    const detail = redact(
      [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
      token,
    );
    throw new Error(`${label} failed (exit ${result.status})${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout || '';
}

/** Recursive listing of regular files (and symlinks, reported separately). */
function listFiles(root) {
  const files = [];
  const walk = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, {withFileTypes: true})) {
      const entryPath = path.join(absolute, entry.name);
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(entryPath, entryRelative);
      } else {
        files.push({
          rel: entryRelative,
          bytes: entry.isFile() ? fs.statSync(entryPath).size : 0,
          symlink: entry.isSymbolicLink(),
        });
      }
    }
  };
  if (!fs.existsSync(root)) return [];
  walk(root, '');
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

function humanBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

/**
 * Describe one hub input (a CONTENT_ROOTS entry or the locale registry): its
 * kind (directory or single file), every file it contributes and the byte
 * total. Validated before the clone, so an incomplete hub checkout aborts
 * before anything in the destination is touched.
 */
function describeSource(root) {
  const absolute = path.join(REPO, root);
  if (!fs.existsSync(absolute)) {
    throw new Error(`hub publish source is missing: ${root} (run from the hub checkout)`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    const files = listFiles(absolute);
    if (files.length === 0) {
      throw new Error(`hub publish source is empty: ${root}/; refusing to publish an empty tree`);
    }
    return {
      root,
      kind: 'dir',
      absolute,
      files,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
    };
  }
  if (!stat.isFile()) {
    throw new Error(`hub publish source is not a regular file or directory: ${root}`);
  }
  return {
    root,
    kind: 'file',
    absolute,
    files: [{rel: '', bytes: stat.size, symlink: false}],
    bytes: stat.size,
  };
}

/** Label used in logs and error messages: directories keep their trailing `/`. */
function rootLabel(spec) {
  return spec.kind === 'dir' ? `${spec.root}/` : spec.root;
}

/**
 * Copy one described source over the destination: a directory replaces the
 * destination tree (destination-only files disappear); a file is overwritten.
 */
function syncSource(spec, destinationRepo) {
  const destination = path.join(destinationRepo, spec.root);
  if (spec.kind === 'dir') {
    fs.rmSync(destination, {recursive: true, force: true});
    fs.cpSync(spec.absolute, destination, {recursive: true});
    return;
  }
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(spec.absolute, destination);
}

/**
 * Fail before the commit when the destination `.gitignore` covers any source.
 *
 * An ignored root is not an "unchanged" run: `git add -A` would silently stage
 * nothing and the language site would keep building stale content. Every
 * violation is reported with the exact rule from `git check-ignore -v`, so the
 * fix is unambiguous. Directory probes end in `/` so a directory-only pattern
 * (`/versioned_docs/`) matches even if the destination has no such directory.
 */
function assertSourcesTrackable(destinationRepo, specs, locale) {
  const violations = [];
  for (const spec of specs) {
    const probe = rootLabel(spec);
    const ignore = spawnSync('git', ['check-ignore', '-v', '--', probe], {
      cwd: destinationRepo,
      encoding: 'utf8',
      env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo'},
    });
    if (ignore.error) {
      throw new Error(`${locale}: git check-ignore could not start: ${ignore.error.message}`);
    }
    if (ignore.status === 0) {
      const rule = (ignore.stdout || '').trim().split('\n')[0] || '(unnamed rule)';
      violations.push({probe, rule});
    } else if (ignore.status !== 1) {
      throw new Error(
        `${locale}: \`git check-ignore\` failed (exit ${ignore.status}) for "${probe}"; ` +
          'cannot prove that the destination repository tracks hub content.',
      );
    }
  }
  if (violations.length === 0) return;
  const listed = violations.map((violation) => `  - ${violation.probe}  <- ${violation.rule}`);
  throw new Error(
    `${locale}: the destination repository ignores ${violations.length} hub source(s), so it ` +
      `can never receive them:\n${listed.join('\n')}\n` +
      'Remove those `.gitignore` rules (keep /work/, /static/, /build/, /node_modules/ and the ' +
      'local caches ignored) so the published trees stay tracked, then retry; see ' +
      'guides/ARCHITECTURE-MULTISITE.md -> "Adopting an existing language repository".',
  );
}

function hubSha() {
  try {
    return git(['rev-parse', 'HEAD'], {label: 'git rev-parse HEAD'}).trim();
  } catch (error) {
    warn(`WARN cannot read the hub commit: ${error.message}`);
    return 'unknown';
  }
}

function renderMessage(template, {sha, locale}) {
  return template
    .replaceAll('<hub-sha>', sha)
    .replaceAll('{sha}', sha)
    .replaceAll('{locale}', locale)
    .trim();
}

/** Locales to publish, honouring --only. Default locale is the hub itself. */
function selectLocales(registry, only) {
  const publishable = Object.keys(registry.locales).filter((locale) => locale !== registry.default);
  if (publishable.length === 0) {
    throw new Error(
      'locales.json declares no non-default locale; there is nothing to publish ' +
        '(the default locale is the hub).',
    );
  }
  if (only.length === 0) return publishable;

  const selected = [];
  for (const wanted of only) {
    if (wanted === registry.default) {
      throw new Error(
        `--only=${wanted}: "${wanted}" is the hub's default locale, not a language repository. ` +
          `Publishable locales: ${publishable.join(', ')}`,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(registry.locales, wanted)) {
      throw new Error(
        `--only=${wanted}: unknown locale. Publishable locales: ${publishable.join(', ')}`,
      );
    }
    if (!selected.includes(wanted)) selected.push(wanted);
  }
  return selected;
}

function missingTokenMessage(registry) {
  const targets = Object.entries(registry.locales)
    .filter(([locale]) => locale !== registry.default)
    .map(([, entry]) => `  - ${entry.repo}`);
  const hubRepo = registry.locales[registry.default].repo;
  return [
    `${TOKEN_ENV} is not set. This script pushes to the language repositories:`,
    ...targets,
    '',
    'Create a fine-grained PAT (GitHub -> Settings -> Developer settings -> Personal access tokens',
    '-> Fine-grained tokens):',
    '  - Repository access: only the repositories listed above',
    '  - Permissions: Contents -> Read and write (nothing else)',
    '',
    `Add it to the hub repository (${hubRepo}) as an Actions secret:`,
    '  Settings -> Secrets and variables -> Actions -> New repository secret',
    `  Name: ${TOKEN_ENV}`,
    '',
    `For a local run: export ${TOKEN_ENV}=... (never commit the token).`,
    'A dry run does not need the token: --dry-run',
  ].join('\n');
}

function publishLocale({locale, entry, token, hub, messageTemplate}) {
  // Validate every hub input first: a missing or empty root is a hub bug, and
  // finding it after half of the destination was replaced is much worse.
  const specs = [...CONTENT_ROOTS, REGISTRY_FILE].map(describeSource);
  const cloneUrl = `https://x-access-token:${token}@github.com/${entry.repo}.git`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `publish-${locale.replace(/[^A-Za-z0-9_-]/g, '-')}-`));
  const result = {locale, repo: entry.repo, committed: false, sha: null, skipped: false};
  try {
    log(`${locale}: cloning ${entry.repo} (depth 1)`);
    git(['clone', '--depth=1', '--no-tags', '--quiet', cloneUrl, tmp], {
      label: `${locale}: git clone`,
      token,
    });
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], {
      label: `${locale}: git rev-parse HEAD`,
      cwd: tmp,
      token,
    }).trim();
    if (!branch || branch === 'HEAD') {
      throw new Error(`${locale}: cannot determine the destination branch (detached HEAD)`);
    }

    for (const spec of specs) {
      syncSource(spec, tmp);
      log(
        `${locale}: ${rootLabel(spec)} ` +
          (spec.kind === 'dir'
            ? `replaced with ${spec.files.length} files (${humanBytes(spec.bytes)})`
            : `overwritten (${humanBytes(spec.bytes)})`),
      );
    }

    // Every copy happened; prove git can actually record it before staging.
    // A destination that ignores a root is a broken contract, not an
    // "unchanged" run: `git add -A` would silently stage nothing and the
    // language site would keep building stale content. This aborts before the
    // commit, with the exact `.gitignore` rule and its remediation.
    assertSourcesTrackable(tmp, specs, locale);

    git(['add', '-A'], {label: `${locale}: git add`, cwd: tmp, token});
    const status = git(['status', '--porcelain'], {
      label: `${locale}: git status`,
      cwd: tmp,
      token,
    });
    if (status.trim() === '') {
      log(`${locale}: up to date (git status is empty); nothing to commit or push`);
      result.skipped = true;
      return result;
    }
    const changed = status.trim().split('\n').length;
    log(`${locale}: ${changed} changed path(s) staged`);

    const message = renderMessage(messageTemplate, {sha: hub, locale});
    git(
      ['-c', `user.name=${gitName}`, '-c', `user.email=${gitEmail}`, 'commit', '-m', message],
      {label: `${locale}: git commit`, cwd: tmp, token},
    );
    const sha = git(['rev-parse', 'HEAD'], {
      label: `${locale}: git rev-parse HEAD`,
      cwd: tmp,
      token,
    }).trim();
    log(`${locale}: committed ${sha.slice(0, 12)} (${message})`);

    log(`${locale}: pushing HEAD:${branch} to ${entry.repo}`);
    git(['push', '--quiet', 'origin', `HEAD:${branch}`], {
      label: `${locale}: git push`,
      cwd: tmp,
      token,
    });
    log(`${locale}: pushed; the language repository's workflow is now triggered`);
    result.committed = true;
    result.sha = sha;
    result.branch = branch;
    return result;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

function printDryRun({registry, locales, hub, messageTemplate, token}) {
  log(`hub ${registry.locales[registry.default].repo} @ ${hub}`);
  log(`registry: ${REGISTRY_FILE} (default "${registry.default}")`);
  log('dry run: no clone, no commit, no push, no network access');
  if (!token) {
    log(`(${TOKEN_ENV} is not set; a dry run does not need it)`);
  }
  const specs = [...CONTENT_ROOTS, REGISTRY_FILE].map(describeSource);
  const contentSpecs = specs.filter((spec) => spec.root !== REGISTRY_FILE);
  const registrySpec = specs.find((spec) => spec.root === REGISTRY_FILE);
  const totalFiles = contentSpecs.reduce((total, spec) => total + spec.files.length, 0);
  const totalBytes = contentSpecs.reduce((total, spec) => total + spec.bytes, 0);

  for (const locale of locales) {
    const entry = registry.locales[locale];
    log(`target ${locale}: ${entry.repo}`);
    for (const spec of contentSpecs) {
      const symlinks = spec.files.filter((file) => file.symlink).length;
      log(
        `  ${rootLabel(spec)}: ` +
          (spec.kind === 'dir'
            ? `replace the destination tree with ${spec.files.length} source files ` +
              `(${humanBytes(spec.bytes)}); destination-only files are deleted`
            : `overwrite the destination file (${humanBytes(spec.bytes)})`) +
          (symlinks > 0 ? `; ${symlinks} symlink(s) are copied as links` : ''),
      );
    }
    log(`  ${REGISTRY_FILE}: overwrite the destination file (${humanBytes(registrySpec.bytes)})`);
    log('  commit: only when `git status --porcelain` is non-empty (idempotent)');
    log(
      `  message: ${renderMessage(messageTemplate, {sha: hub, locale})}` +
        (messageTemplate === DEFAULT_MESSAGE ? '' : '  (from --message)'),
    );
    log("  push: origin HEAD:<the destination repository's default branch>");
    log('  keeps: i18n/, config/, work/, tools/, src/, .github/ and every other destination file');
    log('  requires: the destination tracks every root above (an ignored root aborts before commit)');
  }
  log(
    `dry run complete: ${locales.length} locale(s) would be published; ` +
      `${contentSpecs.length} content root(s) + ${REGISTRY_FILE}: ` +
      `${totalFiles} file(s), ${humanBytes(totalBytes)} in total`,
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    warn(`ERROR ${error.message}`);
    return 1;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }

  let registry;
  try {
    registry = localeRegistry.readRegistry();
  } catch (error) {
    warn(`ERROR ${error.message}`);
    return 1;
  }
  const errors = localeRegistry.validateRegistry(registry);
  if (errors.length > 0) {
    warn(`ERROR locales.json is invalid (${errors.length} problem(s)):`);
    for (const error of errors) warn(`  - ${error}`);
    warn('Run `npm run locales:check` for the full report, then retry.');
    return 1;
  }

  let locales;
  try {
    locales = selectLocales(registry, options.only);
  } catch (error) {
    warn(`ERROR ${error.message}`);
    return 1;
  }

  const token = (process.env[TOKEN_ENV] || '').trim();
  const hub = hubSha();
  const messageTemplate = options.message ?? DEFAULT_MESSAGE;

  if (options.dryRun) {
    try {
      printDryRun({registry, locales, hub, messageTemplate, token});
      return 0;
    } catch (error) {
      warn(`ERROR ${error.message}`);
      return 1;
    }
  }

  if (!token) {
    warn('ERROR ' + missingTokenMessage(registry));
    return 1;
  }

  log(`hub ${registry.locales[registry.default].repo} @ ${hub}`);
  log(`publishing ${locales.length} locale(s); the hub's "${registry.default}" is not published`);

  const results = [];
  const failures = [];
  for (const locale of locales) {
    try {
      results.push(
        publishLocale({locale, entry: registry.locales[locale], token, hub, messageTemplate}),
      );
    } catch (error) {
      // Errors already name the locale on their first line; strip it so the
      // log prefix is not duplicated.
      const detail = redact(error.message, token).replace(
        new RegExp(`^${locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*`),
        '',
      );
      failures.push({locale, detail});
      warn(`${locale}: FAILED ${detail}`);
      log(`${locale}: continuing with the remaining locales (failures are isolated)`);
    }
  }

  const published = results.filter((result) => result.committed).length;
  const unchanged = results.filter((result) => result.skipped).length;
  for (const result of results) {
    if (result.committed) log(`summary: ${result.locale} -> ${result.repo} (${result.sha.slice(0, 12)})`);
    else log(`summary: ${result.locale} -> ${result.repo} (unchanged)`);
  }
  log(`summary: ${published} published, ${unchanged} unchanged, ${failures.length} failed`);

  if (failures.length > 0) {
    warn('ERROR one or more language repositories were not updated:');
    for (const failure of failures) warn(`  - ${failure.locale}: ${failure.detail.split('\n')[0]}`);
    warn(
      'Check CROSS_REPO_TOKEN (Contents: read and write on the affected repository), ' +
        'branch protection on the destination, and the first line of the error above.',
    );
    return 1;
  }
  return 0;
}

process.exitCode = main();
