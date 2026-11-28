#!/usr/bin/env node
/**
 * `npm run translate:ui` — translate the Docusaurus UI catalogues of one locale.
 *
 * The site chrome is not content: the navbar, the footer, the sidebar category
 * labels and the theme strings live in `i18n/<locale>/**.json`, which Docusaurus
 * generates with `write-translations` and reads back at build time. When those
 * files are missing — or still carry the English `message` — the build renders
 * English chrome next to fully translated pages. The zh-Hant site shipped
 * exactly that bug: every navbar entry, sidebar category and footer label read
 * English because `i18n/zh-Hant/docusaurus-theme-classic/` and the
 * `docusaurus-plugin-content-*` catalogs did not exist at all.
 *
 * This command closes that gap inside the pipeline:
 *
 *   1. generate the catalogues with `docusaurus write-translations --locale X`
 *      **only when at least one expected file is missing**, so an existing
 *      (possibly hand-reviewed) catalogue is never overwritten;
 *   2. collect the entries whose `message` is still English: the English source
 *      text itself, or plain ASCII that is not a whitelisted proper noun;
 *   3. translate them with the normal `Client` (locale profile, glossary,
 *      temperature 0) in small batches and write the values back with the
 *      original key order and two-space indentation;
 *   4. leave every value that already carries the target script alone, so a
 *      second run is a no-op.
 *
 * Which files are expected is derived from the repository, not hard-coded: the
 * docs catalog follows `versions.json` (`current.json` plus one
 * `version-<v>.json` per archive), the hardware/blog/changelog catalogs are
 * only required when their content directory exists.
 *
 * `--dry-run` reports the counts and writes nothing (it also does not generate
 * the missing catalogues, because generating is a write). `--json` prints the
 * report on stdout; the human summary then goes to stderr.
 *
 * Exit codes: 0 done, 1 failure (configuration or provider), 2 bad usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  REPO,
  assertTranslationLocale,
  localeRoot,
  writeFileAtomic,
} from './lib/paths.mjs';
import {Client, loadConfig} from './lib/provider.mjs';
import {explainLLMError} from './lib/llm-config.mjs';
import {
  buildWhitelist,
  normalizeTerm,
  placeholders,
  looksUntranslated as needsTranslation,
} from './lib/ui-copy.mjs';

const USAGE = `Usage: npm run translate:ui -- [--locale=<tag>] [--dry-run] [--json] [--batch=<n>]

  --locale=<tag>  translation target (default: this repository's locale)
  --dry-run       report what would be translated, write nothing
  --json          print the report as JSON on stdout (human output on stderr)
  --batch=<n>     strings per request (default 30, small on purpose: a batch of
                  UI labels is cheaper to retry than a page)
`;

/** The catalogues Docusaurus reads, keyed by the plugin directory. */
const THEME = 'docusaurus-theme-classic';
const DOCS = 'docusaurus-plugin-content-docs';
const HARDWARE = 'docusaurus-plugin-content-docs-hardware';
const BLOG = 'docusaurus-plugin-content-blog';
const CHANGELOG = 'docusaurus-plugin-content-blog-changelog';

/** The translation contract for one UI batch (appended to the profile prompt). */
const UI_RULES = [
  'You are localizing the labels of a Docusaurus documentation site: navbar',
  'entries, footer links, sidebar category and page labels, theme buttons.',
  'Input: a JSON array of {"k": <id>, "t": <English UI text>}.',
  'Output: one JSON array of {"k": <the same id>, "t": <the translation>} and',
  'nothing else — no prose, no markdown, no code fence.',
  '',
  'Rules:',
  '- Translate the label, not the concept: keep it as short as the English.',
  '- Keep every {placeholder}, HTML tag and inline code span exactly as written.',
  '- Keep product, brand and protocol names (RouterOS, MikroTik, CAPsMAN, ...)',
  '  in their English spelling.',
  '- No trailing period on a menu entry; no added quotes or brackets.',
  '- Use the wording, register and script of the locale profile above.',
].join('\n');

function usageError(message) {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(2);
}

/** `--name=value` or `--name value`. */
function option(name) {
  const argv = process.argv.slice(2);
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const at = argv.indexOf(`--${name}`);
  if (at !== -1 && argv[at + 1] && !argv[at + 1].startsWith('--')) return argv[at + 1];
  return undefined;
}

function flag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

const JSON_OUTPUT = flag('json');
const DRY_RUN = flag('dry-run');

if (flag('help') || flag('h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const BATCH = Math.max(1, Number(option('batch') ?? 30) || 30);

let LOCALE;
try {
  LOCALE = assertTranslationLocale(option('locale') || DEFAULT_TARGET_LOCALE, {
    readOnly: DRY_RUN,
  });
} catch (error) {
  if (!(error instanceof LocaleError)) throw error;
  usageError(error.message);
}

/** Report to stdout as JSON, human lines to stderr (or stdout when human). */
function report(report, lines) {
  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    for (const line of lines) process.stderr.write(`${line}\n`);
    return;
  }
  for (const line of lines) process.stdout.write(`${line}\n`);
}

/** Absolute path of one repository-relative path. */
const abs = (relativePath) => path.join(REPO, relativePath);
const repoRelative = (absolutePath) =>
  path.relative(REPO, absolutePath).split(path.sep).join('/');
const exists = (relativePath) => fs.existsSync(abs(relativePath));

/**
 * The catalogues this repository is expected to have for one locale.
 *
 * `versions.json` drives the docs archives; a repository without
 * `data/manifests/current-version.json` (a fresh scaffold) falls back to the
 * `versioned_docs/version-*` directories, so the list stays correct either way.
 */
function expectedCatalogues(locale) {
  const root = localeRoot(locale);
  const files = [
    `${THEME}/navbar.json`,
    `${THEME}/footer.json`,
    'code.json',
  ];
  if (exists('docs')) {
    files.push(`${DOCS}/current.json`);
    for (const version of archivedVersions()) files.push(`${DOCS}/version-${version}.json`);
  }
  if (exists('hardware')) files.push(`${HARDWARE}/current.json`);
  if (exists('blog')) files.push(`${BLOG}/options.json`);
  if (exists('changelog')) files.push(`${CHANGELOG}/options.json`);
  return files.map((file) => `${root}/${file}`);
}

/** Archived docs versions, from the manifest when readable, else the dirs. */
function archivedVersions() {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(REPO, 'versions.json'), 'utf8'));
    if (Array.isArray(list)) return list.map(String).filter(Boolean);
  } catch {
    // Fall through to the directory scan.
  }
  const dir = path.join(REPO, 'versioned_docs');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('version-'))
    .map((entry) => entry.name.slice('version-'.length))
    .sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
}

/** Run `docusaurus write-translations` through the repository's own binary. */
function writeTranslations() {
  const local = path.join(REPO, 'node_modules/.bin/docusaurus');
  const command = fs.existsSync(local) ? local : 'npx';
  const args = fs.existsSync(local)
    ? ['write-translations', '--locale', LOCALE]
    : ['--no-install', 'docusaurus', 'write-translations', '--locale', LOCALE];
  const result = spawnSync(command, args, {cwd: REPO, stdio: 'inherit', env: process.env});
  if (result.error || result.status !== 0) {
    throw new Error(
      `docusaurus write-translations --locale ${LOCALE} failed ` +
        `(${result.error ? result.error.message : `exit ${result.status}`}); ` +
        'run `npm ci` and retry.',
    );
  }
}

const WHITELIST = buildWhitelist(LOCALE);

/**
 * True when the message is still English.
 *
 * The rule lives in `lib/ui-copy.mjs` so the sidebar-label planner asks exactly
 * the same question; this wrapper only supplies the locale's whitelist.
 */
function looksUntranslated(message) {
  return needsTranslation(message, {whitelist: WHITELIST});
}

/** Parse the model's answer into a list of `{k, t}` pairs. */
function parseAnswer(answer) {
  const raw = String(answer ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('the model did not return a JSON array');
  }
  const list = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(list)) throw new Error('the model returned JSON that is not an array');
  return list;
}

/** Read every existing catalogue and collect its untranslated entries. */
function collect() {
  const files = expectedCatalogues(LOCALE).filter((file) => fs.existsSync(abs(file)));
  const catalogues = [];
  const pending = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(abs(file), 'utf8'));
    const entries = Object.entries(data);
    let count = 0;
    for (const [key, entry] of entries) {
      const message = typeof entry === 'string' ? entry : entry?.message;
      if (message === undefined || message === null) continue;
      if (!looksUntranslated(message)) continue;
      count += 1;
      pending.push({file, key, message: String(message)});
    }
    catalogues.push({path: file, keys: entries.length, untranslated: count, data});
  }
  return {files, catalogues, pending};
}

/** Write the catalogs whose `message` changed; return the changed paths. */
function flush(catalogues) {
  const written = [];
  for (const catalogue of catalogues) {
    if (!catalogue.dirty) continue;
    const text = `${JSON.stringify(catalogue.data, null, 2)}\n`;
    writeFileAtomic(abs(catalogue.path), text);
    written.push(catalogue.path);
    catalogue.dirty = false;
  }
  return written;
}

/** Translate one batch and apply the accepted values; returns counts. */
async function translateBatch(client, catalogues, items) {
  const payload = items.map((item, index) => ({k: String(index), t: item.message}));
  const user = JSON.stringify(payload);
  const answer = await client.chat(user, {
    system: `${client.system(user)}\n\n${UI_RULES}`,
  });
  const parsed = parseAnswer(answer);
  const byId = new Map();
  for (const entry of parsed) {
    if (entry && entry.k !== undefined && typeof entry.t === 'string') {
      byId.set(String(entry.k), entry.t);
    }
  }

  const byFile = new Map(catalogues.map((catalogue) => [catalogue.path, catalogue]));
  const result = {translated: 0, rejected: []};
  items.forEach((item, index) => {
    const translation = byId.get(String(index));
    const catalogue = byFile.get(item.file);
    if (!catalogue) return;
    if (translation === undefined) {
      result.rejected.push({path: item.file, key: item.key, reason: 'no answer for this id'});
      return;
    }
    const text = translation.trim();
    if (!text) {
      result.rejected.push({path: item.file, key: item.key, reason: 'empty answer'});
      return;
    }
    if (placeholders(text).join('\u0001') !== placeholders(item.message).join('\u0001')) {
      result.rejected.push({
        path: item.file,
        key: item.key,
        reason: 'placeholders changed',
      });
      return;
    }
    if (normalizeTerm(text) === normalizeTerm(item.message)) {
      result.rejected.push({path: item.file, key: item.key, reason: 'returned the English text'});
      return;
    }
    const entry = catalogue.data[item.key];
    if (typeof entry === 'string') catalogue.data[item.key] = text;
    else catalogue.data[item.key] = {...entry, message: text};
    catalogue.dirty = true;
    result.translated += 1;
  });
  return result;
}

async function main() {
  const expected = expectedCatalogues(LOCALE);
  const missing = expected.filter((file) => !exists(file));
  const generated = [];

  if (missing.length && !DRY_RUN) {
    process.stderr.write(
      `missing ${missing.length} UI catalogue(s) for ${LOCALE}; running write-translations\n`,
    );
    writeTranslations();
    for (const file of missing) {
      if (exists(file)) generated.push(file);
    }
  }

  const {catalogues, pending} = collect();
  const untranslated = pending.length;
  const totalKeys = catalogues.reduce((sum, catalogue) => sum + catalogue.keys, 0);

  const result = {
    locale: LOCALE,
    dryRun: DRY_RUN,
    generated,
    wouldGenerate: DRY_RUN ? missing : [],
    missing: expected.filter((file) => !exists(file)),
    catalogues: catalogues.map(({path: file, keys, untranslated: count}) => ({
      path: file,
      keys,
      untranslated: count,
    })),
    keys: totalKeys,
    untranslated,
    translated: 0,
    rejected: [],
  };

  const lines = [];
  for (const catalogue of result.catalogues) {
    lines.push(
      `  ${catalogue.path}: ${catalogue.keys} keys, ${catalogue.untranslated} untranslated`,
    );
  }
  for (const file of result.missing) lines.push(`  missing: ${file}`);

  if (DRY_RUN || untranslated === 0) {
    lines.unshift(
      `${LOCALE}: ${catalogues.length} catalogue(s), ${totalKeys} keys, ` +
        `${untranslated} untranslated${DRY_RUN ? ' (dry run)' : ''}`,
    );
    report(result, lines);
    return 0;
  }

  let client;
  try {
    client = new Client(loadConfig(LOCALE));
  } catch (error) {
    process.stderr.write(`${explainLLMError(error)}\n`);
    return 1;
  }

  let done = 0;
  for (let offset = 0; offset < pending.length; offset += BATCH) {
    const items = pending.slice(offset, offset + BATCH);
    let outcome;
    try {
      outcome = await translateBatch(client, catalogues, items);
    } catch (error) {
      process.stderr.write(`${explainLLMError(error)}\n`);
      flush(catalogues);
      process.stderr.write(
        `stopped after ${done} translated string(s); the catalogues are saved and the ` +
          'next run continues from the untranslated keys\n',
      );
      return 1;
    }
    done += outcome.translated;
    result.rejected.push(...outcome.rejected);
    flush(catalogues);
    process.stderr.write(`  ${done}/${pending.length} strings translated\n`);
  }

  result.translated = done;
  result.remaining = pending.length - done;
  lines.unshift(
    `${LOCALE}: ${catalogues.length} catalogue(s), ${totalKeys} keys, ` +
      `${untranslated} untranslated, ${done} translated`,
  );
  if (result.rejected.length) {
    lines.push(`  ${result.rejected.length} string(s) rejected:`);
    for (const item of result.rejected.slice(0, 10)) {
      lines.push(`    ${item.path} ${item.key}: ${item.reason}`);
    }
  }
  report(result, lines);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`translate:ui failed: ${error.message}\n`);
    process.exit(1);
  },
);
