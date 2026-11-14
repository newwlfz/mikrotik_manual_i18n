#!/usr/bin/env node
/**
 * Append the missing provenance keys to the existing zh-Hans overlays.
 *
 * `translate apply` / `derive` write `translated_at`, `translation_provider`
 * and `translation_model` (lib/provenance.mjs), but every overlay in
 * `i18n/zh-Hans/` predates that and carries none of them. Re-running `apply`
 * would rebuild each body from the English source and the translation memory
 * (`translateBlocks` / `rebuildFromPairs`), which would overwrite the reviewed
 * working tree. This script only appends the three missing keys to the end of
 * each overlay's front matter; the body and every existing key stay byte for
 * byte, and a file that already has all three is not written at all.
 *
 * `translated_at` is the time of the file's last commit (`git log -1
 * --format=%cI`, strict ISO 8601), i.e. when the overlay itself last changed.
 * A file with no history (or an unparseable date, e.g. a shallow clone whose
 * boundary is newer than the file) falls back to the 7.26 capture timestamp.
 * Both fallbacks are counted in the report so a truncated history cannot hide
 * behind the numbers.
 *
 * Provider and model come from `config/translation.yml`, the same source
 * `lib/provenance.mjs` reads, so a later `apply` would write identical values.
 * Missing configuration is an error here: the whole point of the backfill is
 * the three fields, and silently omitting one would make the footer lie.
 *
 *   node tools/translate/backfill-provenance.mjs               # check (default)
 *   node tools/translate/backfill-provenance.mjs --check        # report only
 *   node tools/translate/backfill-provenance.mjs --write        # update overlays
 *   node tools/translate/backfill-provenance.mjs --limit=20     # sample the report
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO, walkMarkdown} from './lib/paths.mjs';
import {quote} from './lib/frontmatter.mjs';

const OVERLAY_ROOT = path.join(REPO, 'i18n/zh-Hans');
const KEYS = ['translated_at', 'translation_provider', 'translation_model'];
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

// The 7.26 capture time: used only when git has nothing usable for a file.
const FALLBACK_TRANSLATED_AT = '2026-11-09T11:35:47+00:00';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const WRITE = process.argv.includes('--write');
const LIMIT = Number(arg('limit', '0')) || 0;

function provenanceConfig() {
  const file = path.join(REPO, 'config/translation.yml');
  if (!fs.existsSync(file)) throw new Error('missing config/translation.yml');
  let config;
  try {
    config = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch (error) {
    throw new Error(`config/translation.yml is not valid YAML: ${error.message}`);
  }
  const provider = config.provider ? String(config.provider) : '';
  const model = config.model ? String(config.model) : '';
  if (!provider || !model) {
    throw new Error('config/translation.yml must define both provider and model');
  }
  return {provider, model};
}

/** `translated_at` for one file: its last commit time, or null when there is none. */
function lastCommitTime(rel) {
  let out;
  try {
    out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
  return out && !Number.isNaN(new Date(out).getTime()) ? out : null;
}

function frontMatterKeys(lines) {
  const keys = new Set();
  for (const line of lines) {
    const key = /^([A-Za-z0-9_-]+)\s*:/.exec(line)?.[1];
    if (key) keys.add(key);
  }
  return keys;
}

/** Put `appended` right before the closing `---`, keeping every other byte. */
function appendFrontMatter(text, match, lines, appended) {
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const frontMatter = [...lines, ...appended].join(eol);
  return `${text.slice(0, match.index)}---${eol}${frontMatter}${eol}---${text.slice(
    match.index + match[0].length,
  )}`;
}

const {provider, model} = provenanceConfig();

const files = walkMarkdown(OVERLAY_ROOT).sort();
const report = {
  root: path.relative(REPO, OVERLAY_ROOT).split(path.sep).join('/'),
  provider,
  model,
  fallbackTimestamp: FALLBACK_TRANSLATED_AT,
  scanned: 0,
  complete: 0,
  changed: 0,
  written: 0,
  added: Object.fromEntries(KEYS.map((key) => [key, 0])),
  fallbackDates: 0,
  translatedAt: {min: null, max: null, distinct: 0},
  skipped: [],
};

const stamps = new Set();

for (const file of files.slice(0, LIMIT || files.length)) {
  report.scanned++;
  const rel = path.relative(REPO, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const match = FRONT_MATTER.exec(text);
  if (!match) {
    report.skipped.push(`${rel}: no front matter`);
    continue;
  }
  const lines = match[1].split(/\r?\n/);
  const present = frontMatterKeys(lines);
  const missing = KEYS.filter((key) => !present.has(key));
  if (!missing.length) {
    report.complete++;
    continue;
  }

  let translatedAt = null;
  if (missing.includes('translated_at')) {
    translatedAt = lastCommitTime(rel);
    if (!translatedAt) {
      translatedAt = FALLBACK_TRANSLATED_AT;
      report.fallbackDates++;
    }
    stamps.add(translatedAt);
    if (!report.translatedAt.min || translatedAt < report.translatedAt.min) {
      report.translatedAt.min = translatedAt;
    }
    if (!report.translatedAt.max || translatedAt > report.translatedAt.max) {
      report.translatedAt.max = translatedAt;
    }
  }

  const values = {
    translated_at: translatedAt,
    translation_provider: provider,
    translation_model: model,
  };
  const appended = missing.map((key) => `${key}: ${quote(values[key])}`);
  const next = appendFrontMatter(text, match, lines, appended);

  // The transform may only append lines: the byte length must grow by exactly
  // those lines and the body must survive untouched. A violation is a bug
  // worth stopping on, not something to write into 4.7k overlays.
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const expected = text.length + eol.length + appended.join(eol).length;
  const body = text.slice(match.index + match[0].length);
  if (next.length !== expected || !next.endsWith(body)) {
    throw new Error(`${rel}: front-matter rewrite changed more than the appended keys`);
  }

  report.changed++;
  for (const key of missing) report.added[key]++;
  if (WRITE) {
    fs.writeFileSync(file, next);
    report.written++;
  }
}

report.translatedAt.distinct = stamps.size;
console.log(JSON.stringify(report, null, 1));
if (!WRITE) console.log('report only; re-run with --write to update the overlays');
