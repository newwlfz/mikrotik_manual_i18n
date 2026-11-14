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
 *   - every root in CONTENT_ROOTS (`docs/` today) replaces the destination
 *     tree of the same name; destination-only files are deleted, so a removed
 *     hub page disappears from the language site as well;
 *   - `locales.json`, byte for byte.
 *
 * What is never touched
 *   - the destination's `i18n/` (the translation overlays), `config/` (its
 *     per-site knobs), `work/` (its local caches) and everything else.
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
 * Only `docs/` today: the corrected English documentation is what the
 * translation workflow consumes. Adding `hardware/`, `blog/`, `changelog/` or
 * `versioned_docs/` is a deliberate change — the destination build must already
 * tolerate a replaced tree before a root is added here.
 */
const CONTENT_ROOTS = ['docs'];
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
    'Publish docs/ and locales.json from the hub to each non-default language',
    'repository, then commit and push. The push triggers that repository\'s',
    'workflow (translate -> build -> deploy).',
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

    for (const root of CONTENT_ROOTS) {
      const source = path.join(REPO, root);
      if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
        throw new Error(`hub content root is missing: ${root}/ (run from the hub checkout)`);
      }
      const destination = path.join(tmp, root);
      const files = listFiles(source);
      if (files.length === 0) {
        throw new Error(`hub content root is empty: ${root}/; refusing to publish an empty tree`);
      }
      fs.rmSync(destination, {recursive: true, force: true});
      fs.cpSync(source, destination, {recursive: true});
      // A destination that ignores the content root is a broken contract, not
      // an "unchanged" run: `git add -A` would silently stage nothing and the
      // language site would keep building stale content. Fail with the exact
      // remediation instead of reporting success. Probe an existing copied file
      // because `check-ignore` matches a directory-only pattern only when it
      // can tell that the path is a directory.
      const probe = `${root}/${files[0].rel}`;
      const ignore = spawnSync('git', ['check-ignore', '-q', '--', probe], {
        cwd: tmp,
        env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo'},
      });
      if (ignore.status === 0) {
        throw new Error(
          `${locale}: the destination repository ignores "${root}/" (.gitignore), so it can ` +
            'never receive hub content. Remove that ignore rule (and stop downloading the old ' +
            'content release in its pages.yml) before publishing; see ' +
            'guides/ARCHITECTURE-MULTISITE.md -> "Adopting an existing language repository".',
        );
      }
      if (ignore.status !== 1) {
        throw new Error(
          `${locale}: \`git check-ignore\` failed (exit ${ignore.status}); cannot prove that ` +
            `"${root}/" is trackable in the destination repository.`,
        );
      }
      log(`${locale}: ${root}/ replaced with ${files.length} files`);
    }

    fs.copyFileSync(path.join(REPO, 'locales.json'), path.join(tmp, 'locales.json'));
    const ignoreRegistry = spawnSync('git', ['check-ignore', '-q', '--', 'locales.json'], {
      cwd: tmp,
      env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo'},
    });
    if (ignoreRegistry.status === 0) {
      throw new Error(
        `${locale}: the destination repository ignores "locales.json" (.gitignore); ` +
          'remove that rule so the registry can be synced.',
      );
    }
    log(`${locale}: locales.json written`);

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
  log(`registry: locales.json (default "${registry.default}")`);
  log('dry run: no clone, no commit, no push, no network access');
  if (!token) {
    log(`(${TOKEN_ENV} is not set; a dry run does not need it)`);
  }
  const summaries = [];
  for (const locale of locales) {
    const entry = registry.locales[locale];
    const fileSets = CONTENT_ROOTS.map((root) => {
      const files = listFiles(path.join(REPO, root));
      const bytes = files.reduce((total, file) => total + file.bytes, 0);
      return {root, count: files.length, bytes, symlinks: files.filter((file) => file.symlink).length};
    });
    summaries.push({locale, entry, fileSets});
    log(`target ${locale}: ${entry.repo}`);
    for (const set of fileSets) {
      log(
        `  ${set.root}/: replace the destination tree with ${set.count} source files ` +
          `(${humanBytes(set.bytes)}); destination-only files are deleted` +
          (set.symlinks > 0 ? `; ${set.symlinks} symlink(s) are copied as links` : ''),
      );
    }
    log('  locales.json: write');
    log(`  commit: only when \`git status --porcelain\` is non-empty (idempotent)`);
    log(
      `  message: ${renderMessage(messageTemplate, {sha: hub, locale})}` +
        (messageTemplate === DEFAULT_MESSAGE ? '' : '  (from --message)'),
    );
    log("  push: origin HEAD:<the destination repository's default branch>");
    log('  keeps: i18n/, config/, work/ and every other destination file');
    log('  requires: the destination tracks docs/ and locales.json (an ignored root aborts the run)');
  }
  const files = summaries[0]?.fileSets.reduce((total, set) => total + set.count, 0) ?? 0;
  log(
    `dry run complete: ${summaries.length} locale(s) would be published` +
      (summaries.length > 0 ? `; ${CONTENT_ROOTS.join(', ')} has ${files} file(s) in total` : ''),
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
    printDryRun({registry, locales, hub, messageTemplate, token});
    return 0;
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
