#!/usr/bin/env node
/**
 * `npm run translate:cli-labels` — deterministic projection of the
 * `compare_versions` table in `config/cli-labels.yml` into
 * `src/components/CliCompare/labels.data.json`.
 *
 * The CliCompare widget runs in the browser, where the YAML config is not
 * importable. `labels.ts` imports this JSON and its custom `t()` uses the exact
 * English key as the English wording; every other locale reads the reviewed
 * value here. So the projection is a pure, idempotent function of the YAML:
 *
 *   - `zh-Hans` (the default for this repository): value from the table;
 *   - `en` (or `--locale=en`): identity mapping, the key itself. Each locale
 *     therefore has exactly one reviewed wording, and no locale's glyphs can
 *     leak into another's file.
 *
 * The key list is fixed here — it is NOT derived from the (possibly empty)
 * config, which is what made the old verifiers spin on zero keys. It mirrors
 * the literal keys passed to `t()` / `compareLabel()` in
 * `src/components/CliCompare/{index.tsx,labels.ts}` character for character,
 * including the capitalised `From` / `To` / `Filter` and the distinct
 * lowercase/capitalised command headings.
 *
 *   node tools/translate/build-cli-labels.mjs             # write the JSON
 *   node tools/translate/build-cli-labels.mjs --check      # verify only
 *   node tools/translate/build-cli-labels.mjs --locale=en  # English identity view
 *
 * `--check` exits 1 on a missing/extra key, an empty value, an English residue
 * in a non-English projection, or a byte mismatch with the committed JSON.
 * Exit codes: 0 ok, 1 check failure, 2 bad usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {DEFAULT_TARGET_LOCALE, REPO} from './lib/paths.mjs';

const CONFIG_FILE = path.join(REPO, 'config/cli-labels.yml');
const OUTPUT_FILE = path.join(REPO, 'src/components/CliCompare/labels.data.json');

/** Exact `t()` / `compareLabel()` keys, in a stable order. */
const COMPLETE_KEYS = Object.freeze([
  'From',
  'To',
  'Filter',
  'Swap versions',
  'Swap From and To versions',
  'path, e.g. ip/firewall',
  'parameters added',
  'parameters removed',
  'commands changed',
  'new commands',
  'commands removed',
  'New commands',
  'Removed commands',
  'Parameter changes',
  'parameters',
  'flags',
  'commands',
  'command',
  'command measure word',
  'Could not load',
  'Loading CLI reference versions…',
  'Not enough CLI reference versions to compare.',
  'Select two different versions to compare.',
  'No parameter differences.',
  'No parameter differences matching the filter.',
  ': ',
  ' of ',
]);

/** Separators are punctuation, not prose: no CJK is expected in their value. */
const SEPARATOR_KEYS = new Set([': ', ' of ']);
const ASCII = /^[\x20-\x7E\u2026]*$/;

const USAGE =
  'Usage: node tools/translate/build-cli-labels.mjs ' +
  '[--check] [--locale=<tag>]\n';

function arg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  return fallback;
}

for (const flag of process.argv.slice(2)) {
  if (flag !== '--check' && !flag.startsWith('--locale=')) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
}

const CHECK = process.argv.includes('--check');
const LOCALE =
  arg('locale', (process.env.SITE_LOCALE || '').trim() || DEFAULT_TARGET_LOCALE) || DEFAULT_TARGET_LOCALE;
const IS_ENGLISH = /^en(?:[-_]|$)/i.test(LOCALE);

function readTable() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  const parsed = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
  const table = parsed.compare_versions;
  return table && typeof table === 'object' && !Array.isArray(table) ? table : {};
}

/** A value that is still the English key (or plain English prose) is residue. */
function isEnglishResidue(key, value) {
  if (IS_ENGLISH) return false; // identity is correct for English
  if (value === key) return true;
  if (SEPARATOR_KEYS.has(key)) return false;
  return ASCII.test(value) && ASCII.test(key);
}

const table = readTable();
const projected = {};
const problems = [];
for (const key of COMPLETE_KEYS) {
  const value = IS_ENGLISH ? key : String(table[key] ?? '');
  if (!value.trim()) {
    problems.push(`missing/empty value for ${JSON.stringify(key)} (locale=${LOCALE})`);
    continue;
  }
  if (isEnglishResidue(key, value)) {
    problems.push(`English residue for ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    continue;
  }
  projected[key] = value;
}
const extra = Object.keys(table).filter((key) => !COMPLETE_KEYS.includes(key));
if (extra.length) problems.push(`unknown key(s) in config: ${extra.join(', ')}`);

const expected = `${JSON.stringify(projected, null, 2)}\n`;
const actual = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf8') : null;

if (CHECK) {
  if (actual === null) problems.push(`missing ${path.relative(REPO, OUTPUT_FILE)}`);
  else if (actual !== expected) problems.push(`${path.relative(REPO, OUTPUT_FILE)} is out of sync with config/cli-labels.yml`);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`FAIL ${problem}\n`);
    process.stderr.write(
      `translate:cli-labels --check: ${problems.length} problem(s) ` +
        `(${COMPLETE_KEYS.length} fixed keys, locale=${LOCALE})\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `ok translate:cli-labels --check: ${COMPLETE_KEYS.length}/${COMPLETE_KEYS.length} keys localized, ` +
      `JSON matches config/cli-labels.yml (locale=${LOCALE})\n`,
  );
  process.exit(0);
}

if (problems.length) {
  for (const problem of problems) process.stderr.write(`FAIL ${problem}\n`);
  process.stderr.write('Refusing to write a partial or English-only label table.\n');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
fs.writeFileSync(OUTPUT_FILE, expected, 'utf8');
process.stdout.write(
  `translate:cli-labels: wrote ${path.relative(REPO, OUTPUT_FILE)} ` +
    `(${COMPLETE_KEYS.length} keys, locale=${LOCALE})\n`,
);
