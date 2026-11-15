#!/usr/bin/env node
/**
 * `npm run locale:add` — scaffold one language repository and register it.
 *
 * A language site is a repository of its own: it owns the translation overlays,
 * the site-level configuration and the build workflow, while the hub
 * (`newwlfz/mikrotik_manual_i18n`) owns the English content and pushes it there
 * (`tools/content/publish.mjs`). Creating that repository by hand means copying
 * ~200 files and getting a dozen addresses right, so this command does the
 * mechanical part:
 *
 *   1. copy `templates/locale-repo/` into a new directory;
 *   2. replace the template placeholders (see below) in every text file;
 *   3. `git init -b main` there — **no commit and no push**;
 *   4. add the locale to `locales.json` (`label`, `repo`, `baseUrl`, `site`,
 *      `siteTitle`, `tagline`) and run `npm run locales:check`. A failing check
 *      restores the previous `locales.json`.
 *
 * What it deliberately does **not** do: create the GitHub repository, add it to
 * the `CROSS_REPO_TOKEN` fine-grained PAT, or set the Actions variables/secret.
 * Those are permissions and production side effects; the operator does them by
 * hand (the printed checklist names each one). This keeps "adding a locale" a
 * local, reviewed change (see `guides/DECISIONS.md` D7 and
 * `guides/ARCHITECTURE-MULTISITE.md` §10).
 *
 * Template placeholders
 *   {{LOCALE}}         BCP 47 tag, e.g. `ru-RU` (`--code`)
 *   {{LOCALE_LABEL}}   display label, e.g. `Русский` (`--label`)
 *   {{SLUG}}           file/repository slug, e.g. `ru_ru` (derived from `--code`)
 *   {{REPO}}           `owner/name` of the new repository (`--repo`)
 *   {{BASE_URL}}       path prefix, starts and ends with `/` (`--base-url`)
 *   {{SITE}}           absolute site address = origin + baseUrl (`--site`)
 *   {{SITE_ORIGIN}}    origin of `--site` (derived)
 *   {{HUB_REPO}}       the hub's `owner/name` (from `locales.json` `en`)
 *   {{HUB_BASE_URL}}   the hub's `baseUrl` (from `locales.json` `en`)
 *   {{ASSET_ORIGIN}}   shared asset host: the hub's site without a trailing
 *                      slash (derived; sites do not ship `static/`)
 *   {{LOCALE_ENV}}     environment-variable prefix, e.g. `RU` (derived)
 *
 * Usage:
 *   npm run locale:add -- --code ru-RU --label Русский
 *   npm run locale:add -- --code ru-RU --label Русский --dry-run
 *
 * Exit codes: 0 success (or dry run), 1 validation/runtime failure, 2 bad usage.
 */

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import localeRegistry from './locales.js';

/** Hub checkout (this file lives in `tools/content/`). */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE_DIR = path.join(REPO, 'templates/locale-repo');
const REGISTRY_FILE = path.join(REPO, 'locales.json');

/** `owner/name`, same subset `locales.js` validates. */
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** BCP 47-ish subset Docusaurus accepts as a locale key. */
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** Any placeholder the template may contain. */
const PLACEHOLDER = /\{\{[A-Za-z0-9_]+\}\}/;

const KNOWN_OPTIONS = new Map([
  ['code', 'code'],
  ['label', 'label'],
  ['repo', 'repo'],
  ['base-url', 'baseUrl'],
  ['site', 'site'],
  ['dir', 'dir'],
  ['site-title', 'siteTitle'],
  ['tagline', 'tagline'],
]);

const USAGE = `Usage: npm run locale:add -- --code <tag> [options]

Scaffold a language repository from templates/locale-repo/ and register the
locale in locales.json. Nothing is created on GitHub and no secret is set;
the printed checklist lists the manual steps that follow.

Required
  --code <tag>        BCP 47 tag, e.g. ru-RU (also the locales.json key)

Optional
  --label <text>      navbar label, e.g. Русский   (default: the tag)
  --repo <owner/name> repository that builds the site
                      (default: <hub owner>/mikrotik_manual_<slug>)
  --base-url </path/> GitHub Pages prefix, starts and ends with /
                      (default: /<repository name>/)
  --site <url>        absolute site address, must end with --base-url
                      (default: https://<hub pages host><base-url>)
  --dir <path>        target directory, relative to the hub checkout
                      (default: ../repo_<slug>); must not exist or be empty
  --site-title <text> site title written to locales.json (default: the hub's)
  --tagline <text>    tagline written to locales.json (default: the hub's)
  --dry-run           print the plan and the locales.json change; write nothing
  -h, --help          print this help
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {dryRun: false, help: false, values: {}};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new UsageError(`unexpected argument "${arg}"`);
    }
    const separator = arg.indexOf('=');
    const name = separator === -1 ? arg.slice(2) : arg.slice(2, separator);
    let value = separator === -1 ? null : arg.slice(separator + 1);
    if (!KNOWN_OPTIONS.has(name)) throw new UsageError(`unknown option "--${name}"`);
    if (value === null) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`--${name} needs a value`);
      }
      index += 1;
    }
    const key = KNOWN_OPTIONS.get(name);
    if (options.values[key] !== undefined) throw new UsageError(`--${name} given twice`);
    options.values[key] = value.trim();
  }
  return options;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

/** Every regular file under `dir`, relative to it. Symlinks are refused. */
function walkFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full));
    else {
      throw new Error(
        `unsupported template entry ${path.relative(base, full)}: only regular files ` +
          'and directories are scaffolded',
      );
    }
  }
  return out.sort();
}

/** Replace `{{NAME}}` in `text`; an unknown or unexpanded placeholder is fatal. */
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

/** Render the whole template in memory: `[{rel, content, bytes}]`. */
function renderPlan(values) {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    throw new Error(`locale template is missing: ${path.relative(REPO, TEMPLATE_DIR)}`);
  }
  const plan = [];
  for (const relativePath of walkFiles(TEMPLATE_DIR)) {
    const source = fs.readFileSync(path.join(TEMPLATE_DIR, relativePath));
    const binary = source.includes(0);
    // Only text files carry placeholders; a binary is copied byte for byte.
    const content = binary ? source : Buffer.from(substitute(source.toString('utf8'), values, relativePath));
    plan.push({rel: substitutePath(relativePath, values), content, bytes: content.length});
  }
  return plan;
}

function checkTargetDir(target) {
  const relative = path.relative(REPO, target);
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(
      `refusing to scaffold inside the hub checkout (${target}); use a sibling directory, ` +
        'or an absolute path such as /tmp/locale-add-test',
    );
  }
  if (!fs.existsSync(target)) return;
  if (!fs.statSync(target).isDirectory()) {
    throw new Error(`target exists and is not a directory: ${target}`);
  }
  if (fs.readdirSync(target).length > 0) {
    throw new Error(
      `target directory is not empty: ${target}; use an empty or a new directory`,
    );
  }
}

/** `git init -b main`, falling back for a Git older than 2.28. */
function initGit(target) {
  let result = spawnSync('git', ['init', '-b', 'main'], {cwd: target, encoding: 'utf8'});
  if (result.status !== 0) {
    result = spawnSync('git', ['init'], {cwd: target, encoding: 'utf8'});
    if (result.status === 0) {
      spawnSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/main'], {cwd: target, encoding: 'utf8'});
    }
  }
  return result.status === 0 ? String(result.stdout || '').trim() : null;
}

function runLocalesCheck() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', '--silent', 'locales:check'], {cwd: REPO, stdio: 'inherit'});
  if (result.error) throw new Error(`could not run "npm run locales:check": ${result.error.message}`);
  return result.status === 0;
}

function writeFileAtomic(file, text) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, text);
  fs.renameSync(temporary, file);
}

/** Next steps, printed after a successful scaffold (and after a dry run). */
function nextSteps({code, repo, dir}) {
  return [
    'Next steps (manual on purpose — nothing on GitHub was created or configured):',
    `  1. Create the repository ${repo} on GitHub (public).`,
    `  2. Add ${repo} to the repository list of the CROSS_REPO_TOKEN fine-grained`,
    '     PAT ("Contents: read and write"), so the hub can push content into it.',
    `  3. In ${repo}: Settings → Secrets and variables → Actions — add the`,
    '     variables LLM_BASE_URL and LLM_MODEL, and the secret LLM_API_KEY.',
    `  4. cd ${dir}`,
    '     git add -A && git commit -m "init"   # this script made no commit',
    `     git remote add origin https://github.com/${repo}.git`,
    '     git push -u origin main',
    `  5. Back in the hub: npm run content:publish -- --only=${code}`,
    '     (or wait for the scheduled publish) to ship the content and start the',
    '     first translate batch.',
  ].join('\n');
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`[locale:add] ERROR ${error.message}\n`);
    console.error(USAGE);
    return 2;
  }
  if (options.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  try {
    return run(options);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[locale:add] ERROR ${error.message}\n`);
      console.error(USAGE);
      return 2;
    }
    console.error(`[locale:add] ERROR ${error.message}`);
    return 1;
  }
}

function run(options) {
  const {values, dryRun} = options;

  // --- 1. arguments ---------------------------------------------------------
  const code = values.code;
  if (!code) throw new UsageError('--code is required (a BCP 47 tag, e.g. ru-RU)');
  if (!LOCALE_PATTERN.test(code)) {
    throw new UsageError(
      `--code "${code}" is not a valid language tag (expected e.g. ru-RU, pt-BR, sr-Latn)`,
    );
  }
  try {
    // `Intl.Locale` rejects tags the regex lets through (and vice versa).
    new Intl.Locale(code);
  } catch {
    throw new UsageError(`--code "${code}" is not a valid BCP 47 language tag`);
  }
  const label = (values.label || code).trim();
  if (!label) throw new UsageError('--label must not be empty');

  const registry = localeRegistry.readRegistry();
  const hub = registry.locales[registry.default];
  if (!hub) {
    throw new Error(
      `locales.json has no "${registry.default}" entry; the hub must register itself first`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(registry.locales, code)) {
    throw new Error(
      `locales.json already declares "${code}" (${registry.locales[code].repo}); ` +
        'edit that entry instead of adding a second one',
    );
  }

  const hubOwner = hub.repo.split('/')[0];
  const slug = code.toLowerCase().replace(/-/g, '_');
  if (!/^[a-z0-9_]+$/.test(slug)) {
    throw new Error(`cannot derive a repository slug from "${code}"`);
  }

  const repo = values.repo || `${hubOwner}/mikrotik_manual_${slug}`;
  if (!REPO_PATTERN.test(repo) || repo.includes('..') || repo.split('/')[0].startsWith('.')) {
    throw new UsageError(`--repo "${repo}" must look like "owner/name"`);
  }
  const repoName = repo.split('/')[1];
  const owner = repo.split('/')[0];

  const baseUrl = values.baseUrl || `/${repoName}/`;
  if (!baseUrl.startsWith('/') || !baseUrl.endsWith('/')) {
    throw new UsageError(`--base-url "${baseUrl}" must start and end with "/"`);
  }

  const pagesHost = owner.toLowerCase() === hubOwner.toLowerCase()
    ? localeRegistry.siteOrigin(hub)
    : `https://${owner.toLowerCase()}.github.io`;
  let site = values.site || `${pagesHost}${baseUrl}`;
  if (!site.endsWith('/')) site = `${site}/`;
  let parsedSite;
  try {
    parsedSite = new URL(site);
  } catch {
    throw new UsageError(`--site "${site}" is not an absolute URL`);
  }
  if (parsedSite.protocol !== 'https:' && parsedSite.protocol !== 'http:') {
    throw new UsageError(`--site "${site}" must be an http(s) URL`);
  }
  const sitePath = parsedSite.pathname.endsWith('/') ? parsedSite.pathname : `${parsedSite.pathname}/`;
  if (!sitePath.endsWith(baseUrl)) {
    throw new UsageError(`--site "${site}" must end with --base-url "${baseUrl}"`);
  }

  const siteTitle = (values.siteTitle || hub.siteTitle || 'RouterOS Manual').trim();
  const tagline = (values.tagline || hub.tagline || '').trim();
  const dir = path.resolve(REPO, values.dir || `../repo_${slug}`);
  checkTargetDir(dir);

  // --- 2. placeholders and the registry entry ------------------------------
  const valuesMap = {
    LOCALE: code,
    LOCALE_LABEL: label,
    SLUG: slug,
    REPO: repo,
    BASE_URL: baseUrl,
    SITE: site,
    SITE_ORIGIN: parsedSite.origin,
    HUB_REPO: hub.repo,
    HUB_BASE_URL: hub.baseUrl,
    ASSET_ORIGIN: localeRegistry.normalizeSiteUrl(hub.site),
    LOCALE_ENV: localeRegistry.localeEnvPrefix(code),
  };

  const entry = {label, repo, baseUrl, site, siteTitle};
  if (tagline) entry.tagline = tagline;

  const candidate = {
    default: registry.default,
    locales: {...registry.locales, [code]: entry},
  };
  const errors = localeRegistry.validateRegistry(candidate);
  if (errors.length > 0) {
    throw new Error(
      `the new locales.json entry would be invalid:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
    );
  }

  // --- 3. plan (rendered before any write, so a dry run is exact) -----------
  const plan = renderPlan(valuesMap);
  const totalBytes = plan.reduce((total, item) => total + item.bytes, 0);

  console.log(`[locale:add] locale      ${code} (${label})`);
  console.log(`[locale:add] repository  ${repo}`);
  console.log(`[locale:add] site        ${site}`);
  console.log(`[locale:add] target      ${dir}`);
  console.log(`[locale:add] files       ${plan.length} (${formatSize(totalBytes)})`);

  if (dryRun) {
    console.log('[locale:add] dry run — nothing was written');
    console.log('[locale:add] locales.json would gain:');
    console.log(
      JSON.stringify({[code]: entry}, null, 2)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    );
    return 0;
  }

  // --- 4. scaffold ----------------------------------------------------------
  fs.mkdirSync(dir, {recursive: true});
  for (const item of plan) {
    const file = path.join(dir, item.rel);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, item.content);
  }
  console.log(`[locale:add] wrote ${plan.length} files (${formatSize(totalBytes)}) to ${dir}`);

  if (initGit(dir) === null) {
    console.warn(
      '[locale:add] WARNING git init failed; the files are in place but the directory ' +
        'is not a repository yet — run "git init -b main" there before the manual push',
    );
  } else {
    console.log('[locale:add] git repository initialised on branch main (no commit, no push)');
  }

  // --- 5. register and self-check ------------------------------------------
  const previous = fs.readFileSync(REGISTRY_FILE, 'utf8');
  writeFileAtomic(REGISTRY_FILE, `${JSON.stringify(candidate, null, 2)}\n`);
  console.log(`[locale:add] locales.json: added "${code}" (${repo})`);

  if (!runLocalesCheck()) {
    writeFileAtomic(REGISTRY_FILE, previous);
    console.error(
      `[locale:add] ERROR "npm run locales:check" rejected the new entry; ` +
        'locales.json was restored. The scaffold at ' +
        `${dir} was left in place; remove it once the problem is understood.`,
    );
    return 1;
  }

  console.log('[locale:add] npm run locales:check: OK');
  console.log(`\n${nextSteps({code, label, repo, dir})}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
