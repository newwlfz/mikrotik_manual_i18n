#!/usr/bin/env node
/**
 * Append the missing provenance keys to the existing overlays of this locale.
 *
 * `translate apply` / `derive` write `translated_at`, `translation_provider`
 * and `translation_model` (lib/provenance.mjs), but an overlay tree that was
 * bootstrapped from a conversion (zh-Hant was OpenCC-converted from the zh-Hans
 * corpus) carries none of them, so the page footer cannot print when the page
 * was translated or by whom. Re-running `apply` would rebuild each body from
 * the English source and the translation memory, which would overwrite the
 * reviewed working tree. This script only appends the missing keys to the end of
 * each overlay's front matter; the body and every existing key stay byte for
 * byte, and a file that already has all three is not written at all.
 *
 * `translated_at` is *approximated* by the time of the file's last commit
 * (`git log --format=%cI`, strict ISO 8601): the conversion did not record when
 * each page was translated, and the commit that introduced the file is the
 * closest honest date. It is a lower bound on "translated at", not a claim that
 * the wording was produced in that minute. A file with no history (or an
 * unparseable date, e.g. a shallow clone whose boundary is newer than the file)
 * falls back to the 7.26 capture timestamp. Both fallbacks are counted in the
 * report so a truncated history cannot hide behind the numbers.
 *
 * Provider and model come from `lib/provenance.mjs` - the endpoint-derived
 * provider (`opencode-go` from `LLM_BASE_URL`) with `config/translation.yml` as
 * the offline fallback - so a later `apply` would write identical values.
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
import {DEFAULT_TARGET_LOCALE, REPO, walkMarkdown} from './lib/paths.mjs';
import {quote} from './lib/frontmatter.mjs';
import {translationProvenance} from './lib/provenance.mjs';

const OVERLAY_ROOT = path.join(REPO, 'i18n', DEFAULT_TARGET_LOCALE);
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
  // Same derivation the pipeline uses (endpoint first, config second), so the
  // backfilled values are the ones a later `apply` would write.
  const values = translationProvenance({existing: null});
  const provider = values.translation_provider || '';
  const model = values.translation_model || '';
  if (!provider || !model) {
    throw new Error(
      'no provider/model: set LLM_BASE_URL + LLM_MODEL, or define both in config/translation.yml',
    );
  }
  return {provider, model};
}

/**
 * Last commit time of every tracked path, from one `git log` walk.
 *
 * This used to be one `git log -1` per file; with 4.7k overlays that is 4.7k
 * processes. The walk is newest-first, so the first time a path appears is its
 * last commit.
 */
function commitTimes() {
  const map = new Map();
  let out;
  try {
    out = execFileSync('git', ['log', '--format=--%cI', '--name-only'], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch {
    return map;
  }
  let stamp = null;
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('--')) {
      const value = line.slice(2);
      stamp = value && !Number.isNaN(new Date(value).getTime()) ? value : null;
      continue;
    }
    if (stamp && !map.has(line)) map.set(line, stamp);
  }
  return map;
}

const COMMIT_TIMES = commitTimes();

/** `translated_at` for one file: its last commit time, or null when there is none. */
function lastCommitTime(rel) {
  const value = COMMIT_TIMES.get(rel);
  return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
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
