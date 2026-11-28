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
 *   - every root in CONTENT_ROOTS: directories (`docs/`, `hub-docs/`,
 *     `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`,
 *     `versioned_sidebars/`) replace the destination tree of the same name, so
 *     destination-only files are deleted and a removed hub page disappears
 *     from the language site as well; single files (`sidebars.ts`,
 *     `sidebars-hardware.ts`, `versions.json`) are overwritten in place.
 *     `hub-docs/` carries the English README/guides only: locale repositories
 *     translate it into `i18n/<locale>/docusaurus-plugin-content-hub-docs/`,
 *     so the published tree itself must stay byte-identical;
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
 *   --only=<locale>  publish one non-default locale (repeatable). Without
 *                    CROSS_REPO_TOKEN this switches to a local copy simulation
 *                    (no clone/commit/push) and prints the rebuild list.
 *   --local          force that local simulation even when a token is present
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
import {
  CONTENT_ROOTS,
  REGISTRY_FILE,
  EXPECTED_SYNC_LIST,
  BYTE_IDENTICAL_ENTRIES,
  sha256Entry,
  collectFanout,
} from './sync-contract.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/*
 * The content roots and the registry file name used to be declared here.
 * They now come from `sync-contract.mjs`, the single source of truth shared
 * with `fanout-check.mjs`, so the publisher and the assertion can never drift
 * apart. Adding a root is still deliberate: the destination build must
 * tolerate a replaced tree and must not `.gitignore` it (asserted below).
 */
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
    local: false,
    only: [],
    message: null,
    help: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--local' || arg === '--simulate') options.local = true;
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
    'usage: node tools/content/publish.mjs [--dry-run] [--local] [--only=<locale>] [--message=<text>]',
    '',
    'Publish every content root plus locales.json from the hub to each',
    'non-default language repository, then commit and push. The push triggers',
    "that repository's workflow (translate -> build -> deploy). A registry or",
    'structure change needs every repository rebuilt; the "需重建" list is printed',
    'after every run (including the local simulation).',
    '',
    `content roots: ${CONTENT_ROOTS.join(', ')} (+ ${REGISTRY_FILE})`,
    '',
    '  --dry-run        print the plan; no network, no clone, no commit, no push',
    '  --only=<locale>  publish one non-default locale (repeatable); without a',
    '                   token it runs the local copy simulation instead',
    '  --local          force the local copy simulation (no token, no push)',
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
 *
 * The authoritative "is it ignored?" signal is `git check-ignore -q`'s exit
 * code: 0 means ignored, 1 means not ignored. Do not derive it from `-v`'s
 * output: when the last matching rule is a negation (`!locales.json`), `-v`
 * still prints that rule and exits 0 to explain the match, even though the
 * path is NOT ignored. Treating that as a violation rejects a perfectly
 * trackable destination. `-v` is only used below to render the rule for a
 * genuine violation.
 */
function assertSourcesTrackable(destinationRepo, specs, locale) {
  const violations = [];
  const env = {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo'};
  for (const spec of specs) {
    const probe = rootLabel(spec);
    const ignored = spawnSync('git', ['check-ignore', '-q', '--', probe], {
      cwd: destinationRepo,
      encoding: 'utf8',
      env,
    });
    if (ignored.error) {
      throw new Error(`${locale}: git check-ignore could not start: ${ignored.error.message}`);
    }
    if (ignored.status === 1) continue; // not ignored — including negation rules
    if (ignored.status !== 0) {
      throw new Error(
        `${locale}: \`git check-ignore\` failed (exit ${ignored.status}) for "${probe}"; ` +
          'cannot prove that the destination repository tracks hub content.',
      );
    }
    // Genuinely ignored: recover the exact rule for an actionable message.
    const verbose = spawnSync('git', ['check-ignore', '-v', '--', probe], {
      cwd: destinationRepo,
      encoding: 'utf8',
      env,
    });
    const rule =
      (verbose.stdout || '').trim().split('\n')[0] || '(unnamed rule)';
    violations.push({probe, rule});
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
    // An English-only hub has no language repositories to feed. This is a valid
    // registry state, not a publisher error: report it and let main() exit 0 so
    // the `publish-content` job stays green while the hub is being prepared.
    log('no non-default locales to publish; skipping');
    return [];
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

/**
 * Print the "需重建" list: a registry or structure fan-out changes every
 * site's entry/dropdown/navigation, so *all* three `pages.yml` jobs must run;
 * a content-only change rebuilds only the locales actually published.
 */
function printRebuildPlan({registry, locales, reasonsByLocale = {}, commonReason, source}) {
  const targets = [...new Set([...locales, ...Object.keys(reasonsByLocale)])];
  log(`需重建 (${targets.length}) [${source}]:`);
  if (targets.length === 0) log('  (none)');
  for (const locale of targets) {
    const reasons = [...(reasonsByLocale[locale] || [])];
    if (commonReason && !reasons.includes(commonReason)) reasons.push(commonReason);
    const repo = registry.locales[locale]?.repo || '(unknown)';
    log(`  - ${locale} -> ${repo}${reasons.length ? `: ${reasons.join('; ')}` : ''}`);
  }
}

/**
 * Local simulation of one publish: copy the hub payload into a scratch tree
 * (no clone, no token, no commit, no push), then compare the three local
 * checkouts and print what a real fan-out would have to rebuild.
 */
function localSimulation({registry, locales}) {
  log(`no ${TOKEN_ENV}: local copy simulation (no clone, no commit, no push)`);
  const specs = [...EXPECTED_SYNC_LIST].map(describeSource);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-simulation-'));
  try {
    let files = 0;
    let bytes = 0;
    for (const spec of specs) {
      syncSource(spec, tmp);
      files += spec.files.length;
      bytes += spec.bytes;
    }
    log(
      `simulated payload: ${specs.length} entries (${CONTENT_ROOTS.length} content roots + ` +
        `${REGISTRY_FILE}), ${files} file(s), ${humanBytes(bytes)} copied locally`,
    );

    let state = null;
    try {
      state = collectFanout({hubPath: REPO});
    } catch (error) {
      warn(`WARN cannot read local checkout state: ${error.message}`);
    }
    const drift = state
      ? state.identity.filter((item) => !item.equal).map((item) => item.entry)
      : [];
    const global = drift.length > 0;
    const reasonsByLocale = {};
    if (state) {
      for (const item of state.rebuild) reasonsByLocale[item.locale] = item.reasons;
    }
    printRebuildPlan({
      registry,
      locales: global ? Object.keys(registry.locales) : locales,
      reasonsByLocale,
      commonReason: global
        ? `注册表/结构漂移 (${drift.join(', ')}) -> 所有语种仓 pages.yml rebuild`
        : `--only 内容发布 -> 目标仓 pages.yml rebuild`,
      source: 'local simulation',
    });
    log('simulation complete: nothing was pushed; CI uses CROSS_REPO_TOKEN for the real fan-out');
    return 0;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

function publishLocale({locale, entry, token, hub, messageTemplate}) {
  // Validate every hub input first: a missing or empty root is a hub bug, and
  // finding it after half of the destination was replaced is much worse.
  const specs = [...CONTENT_ROOTS, REGISTRY_FILE].map(describeSource);
  const cloneUrl = `https://x-access-token:${token}@github.com/${entry.repo}.git`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `publish-${locale.replace(/[^A-Za-z0-9_-]/g, '-')}-`));
  const result = {locale, repo: entry.repo, committed: false, sha: null, skipped: false, changedEntries: []};
  try {
    const before = new Map(specs.map((spec) => [spec.root, sha256Entry(path.join(tmp, spec.root))]));
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
    result.changedEntries = specs
      .filter((spec) => before.get(spec.root) !== sha256Entry(spec.absolute))
      .map((spec) => spec.root);

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
  let state = null;
  try {
    state = collectFanout({hubPath: REPO});
  } catch (error) {
    warn(`WARN cannot read local checkout state: ${error.message}`);
  }
  const drift = state ? state.identity.filter((item) => !item.equal).map((item) => item.entry) : [];
  const reasonsByLocale = {};
  if (state) for (const item of state.rebuild) reasonsByLocale[item.locale] = item.reasons;
  printRebuildPlan({
    registry,
    locales: drift.length ? Object.keys(registry.locales) : locales,
    reasonsByLocale,
    commonReason: drift.length
      ? `注册表/结构漂移 (${drift.join(', ')}) -> 所有语种仓 pages.yml rebuild`
      : `--only 内容发布 -> 目标仓 pages.yml rebuild`,
    source: 'dry run (current local state)',
  });
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
  // selectLocales() returns an empty list only when the registry declares no
  // non-default locale. It already logged the skip message; do not look for a
  // token, clone or publish anything in that case.
  if (locales.length === 0) return 0;

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

  // Local copy simulation: --local forces it; --only without a token uses it
  // too, because a language checkout is available locally in this workspace.
  if (options.local || (!token && options.only.length > 0)) {
    return localSimulation({registry, locales});
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

  const changedEntries = [...new Set(results.flatMap((result) => result.changedEntries))];
  const globalChange =
    changedEntries.includes(REGISTRY_FILE) ||
    changedEntries.some((entry) => BYTE_IDENTICAL_ENTRIES.includes(entry) && entry !== REGISTRY_FILE);
  printRebuildPlan({
    registry,
    locales: globalChange ? Object.keys(registry.locales) : locales,
    commonReason: globalChange
      ? `注册表/结构变更 (${changedEntries.filter((entry) => BYTE_IDENTICAL_ENTRIES.includes(entry)).join(', ')}) -> 所有语种仓 pages.yml rebuild`
      : '已发布内容变更 -> 目标仓 pages.yml rebuild',
    source: 'real publish',
  });

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
