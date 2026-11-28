#!/usr/bin/env node
/**
 * `npm run translate:readme` — localise this repository's root README.md.
 *
 * The English source is `hub-docs/README.md`, published here by the hub's
 * `publish-content` job. The README is a translation product of this repository,
 * not a per-locale template variant: the scaffold template carries one English
 * skeleton only. This tool translates the whole English document into the
 * repository locale with the same `Client` every other translation tool uses
 * (locale profile, glossary, product-name rule and the Taiwan/mainland script
 * guards are all part of `client.system()`).
 *
 * Safety properties:
 *
 *   1. Prose only. Every fenced block, inline code span, command, path,
 *      environment-variable name, Markdown link target and URL must survive the
 *      answer byte for byte. The answer is checked before it is written; a
 *      mismatch keeps the existing README and reports `verification_failed`.
 *   2. Placeholders. A source that still contains `{{...}}` scaffold tokens is
 *      never sent to the model: the safe action is to skip with a warning.
 *   3. Idempotent. The sha256 of the English source is stored in
 *      `state/readme-translate.json` (a git-tracked file, unlike the scratch
 *      files under `work/translate/`). An unchanged source makes the next run
 *      exit immediately without a request.
 *   4. Incremental. This is an enhancement to the translate chain, not a gate:
 *      a missing source, a configuration problem, an LLM error or a verification
 *      failure prints a warning, leaves README.md untouched and exits 0.
 *
 * `--dry-run` performs the source/state checks and prints a report without any
 * write or LLM request. `--json` prints the machine-readable report on stdout.
 *
 * Exit codes: 0 done or safely skipped/failed, 2 bad usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  assertTranslationLocale,
  writeFileAtomic,
} from './lib/paths.mjs';
import {Client, loadConfig} from './lib/provider.mjs';
import {explainLLMError} from './lib/llm-config.mjs';

const USAGE = `Usage: npm run translate:readme -- [--locale=<tag>] [--dry-run] [--json]

  --locale=<tag>  translation target (default: this repository's locale)
  --dry-run       check source/state, print a report; no write and no LLM call
  --json          print the report as JSON on stdout (human output on stderr)
`;

const SOURCE_REL = 'hub-docs/README.md';
const TARGET_REL = 'README.md';
// `work/translate/*` is gitignored; `state/` is committed by the translate job,
// so the source hash survives to the next scheduled batch.
const STATE_REL = 'state/readme-translate.json';

const SOURCE = path.join(REPO, SOURCE_REL);
const TARGET = path.join(REPO, TARGET_REL);
const STATE = path.join(REPO, STATE_REL);

/** README-specific contract, appended to `client.system()` (which already has
 * the generic rules, locale profile and the Taiwan/mainland script guards). */
const README_RULES = [
  'You are localizing a repository root README.md, one whole Markdown document.',
  'Input: the complete English README.md. Output: the complete README.md in the target language.',
  'Translate natural-language prose only: headings, sentences, table prose and list items.',
  'Copy byte for byte: every fenced code block (including its fence lines and language tag),',
  'inline code span, shell command, file path, environment variable name, Markdown link target,',
  'URL (also inside <...>), table pipes/separators and list markers.',
  'Never change or translate a {{PLACEHOLDER}} token; leave it exactly as written.',
  'Keep the same section order, the same number of sections and the same tables. Do not add',
  'a preface, a translation note or an outer code fence around the answer.',
].join('\n');

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

if (flag('help') || flag('h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const JSON_OUTPUT = flag('json');
const DRY_RUN = flag('dry-run');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const report = {
  tool: 'translate:readme',
  locale: option('locale') || DEFAULT_TARGET_LOCALE,
  source: SOURCE_REL,
  target: TARGET_REL,
  state: STATE_REL,
  dryRun: DRY_RUN,
  status: 'pending',
  sourceSha: null,
  calls: 0,
  warnings: [],
};

/** Print the report and finish. Failures are warnings: this tool never gates. */
function finish(status, extra = {}) {
  Object.assign(report, extra, {status});
  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const line = (key, value) => process.stderr.write(`  ${key.padEnd(12)} ${value}\n`);
    process.stderr.write(`translate:readme: ${status}\n`);
    line('locale', report.locale);
    line('sourceSha', report.sourceSha || '(none)');
    if (report.model) line('model', report.model);
    if (report.reason) line('reason', String(report.reason).split('\n')[0]);
    for (const warning of report.warnings) process.stderr.write(`warning: ${warning}\n`);
  }
  const reason = report.reason ? `: ${String(report.reason).split('\n')[0]}` : '';
  if (['failed', 'verification_failed', 'skipped_no_source', 'skipped_placeholders'].includes(status)) {
    process.stderr.write(`warning: repository README localization did not run${reason}; the existing README.md is unchanged.\n`);
  }
  process.exit(0);
}

/**
 * Every byte-level token that must survive translation verbatim.
 *
 * Fenced blocks are matched whole; inline code and URLs are matched as tokens.
 * Standalone env-var names are included as well, in case a name appears outside
 * backticks in a table cell.
 */
function protectedTokens(text) {
  const tokens = new Set();
  for (const match of text.matchAll(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm)) {
    tokens.add(match[0].trimEnd());
  }
  for (const match of text.matchAll(/`[^`\n]+`/g)) tokens.add(match[0]);
  for (const match of text.matchAll(/https?:\/\/[^\s<>()\]}]+/g)) tokens.add(match[0]);
  for (const match of text.matchAll(/\b(?:LLM|SITE|BASE|ASSET|CROSS|BUILD)_[A-Z0-9_]+\b/g)) {
    tokens.add(match[0]);
  }
  return tokens;
}

/** Count fence/heading lines: structure must not be added or dropped. */
function structure(text) {
  const lines = text.split('\n');
  return {
    fences: lines.filter((line) => /^[ \t]*```/.test(line)).length,
    headings: lines.filter((line) => /^#{1,6}\s/.test(line)).length,
  };
}

/** A model that wrapped the whole answer in a markdown fence: unwrap it. */
function unwrapAnswer(text) {
  const lines = String(text ?? '').trimEnd().split('\n');
  if (lines.length >= 2 && /^```[A-Za-z0-9_+-]*$/.test(lines[0]) && lines.at(-1) === '```') {
    return lines.slice(1, -1).join('\n');
  }
  return String(text ?? '');
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function main() {
  let locale;
  try {
    locale = assertTranslationLocale(report.locale, {readOnly: DRY_RUN});
  } catch (error) {
    return finish('failed', {reason: error.message, model: null});
  }
  report.locale = locale;

  if (!fs.existsSync(SOURCE)) {
    return finish('skipped_no_source', {
      reason: `${SOURCE_REL} is not present; the hub publishes it to this repository`,
    });
  }
  const source = fs.readFileSync(SOURCE, 'utf8');
  // Safe path for a scaffold-era source: never send template tokens to the LLM.
  const placeholders = [...new Set(source.match(/\{\{[^{}]+\}\}/g) || [])];
  if (placeholders.length) {
    return finish('skipped_placeholders', {
      sourceSha: sha256(source),
      reason: `source still has ${placeholders.length} scaffold placeholder(s): ${placeholders.join(', ')}`,
    });
  }
  const sourceSha = sha256(source);
  report.sourceSha = sourceSha;

  const state = readState();
  if (state?.locale === locale && state?.sourceSha === sourceSha && fs.existsSync(TARGET)) {
    return finish('unchanged', {
      model: state.model || null,
      translatedSha: state.translatedSha || null,
      reason: 'source sha256 is unchanged since the last translation',
    });
  }
  // A read-only probe stops here: it has checked the source and the state but
  // neither calls the provider nor writes README/state.
  if (DRY_RUN) {
    return finish('dry_run', {
      model: state?.model || null,
      reason: 'source changed or not translated yet; a real run would request one translation',
    });
  }

  let config;
  try {
    config = loadConfig(locale);
  } catch (error) {
    return finish('failed', {reason: explainLLMError(error) || error.message});
  }
  report.model = config.model;
  // A whole README is larger than one content block; give this single request
  // room for the complete answer without touching config/translation.yml.
  const client = new Client(config);
  client.maxTokens = Math.max(client.maxTokens || 0, 8192);

  const expected = protectedTokens(source);
  const expectedStructure = structure(source);

  let translated;
  try {
    const system = `${client.system(source)}\n\n${README_RULES}`;
    translated = unwrapAnswer(await client.chat(source, {system}));
  } catch (error) {
    return finish('failed', {
      reason: explainLLMError(error) || error?.message || String(error),
      calls: client.usage.calls,
    });
  }
  report.calls = client.usage.calls;
  translated = `${translated.trim()}\n`;

  const missing = [...expected].filter((token) => !translated.includes(token));
  const actualStructure = structure(translated);
  if (missing.length || translated === source ||
      actualStructure.fences !== expectedStructure.fences ||
      actualStructure.headings !== expectedStructure.headings) {
    const reasons = [];
    if (missing.length) reasons.push(`${missing.length} protected token(s) missing (e.g. ${missing.slice(0, 3).join(' ')})`);
    if (translated === source) reasons.push('answer is byte-identical to the English source');
    if (actualStructure.fences !== expectedStructure.fences) {
      reasons.push(`fence lines ${expectedStructure.fences} -> ${actualStructure.fences}`);
    }
    if (actualStructure.headings !== expectedStructure.headings) {
      reasons.push(`headings ${expectedStructure.headings} -> ${actualStructure.headings}`);
    }
    return finish('verification_failed', {
      reason: reasons.join('; '),
      translatedSha: sha256(translated),
    });
  }

  const translatedSha = sha256(translated);
  report.translatedSha = translatedSha;

  try {
    writeFileAtomic(TARGET, translated);
    writeFileAtomic(
      STATE,
      `${JSON.stringify(
        {
          version: 1,
          locale,
          source: SOURCE_REL,
          sourceSha,
          translatedSha,
          model: config.model,
          at: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    return finish('failed', {reason: `write failed: ${error.message}`, translatedSha});
  }
  return finish('translated', {translatedSha});
}

await main();
