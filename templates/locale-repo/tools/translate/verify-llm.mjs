#!/usr/bin/env node
/**
 * Check the LLM connection used by `tools/translate`.
 *
 *   node tools/translate/verify-llm.mjs --dry-run
 *       Validate the variables, the URL shape and the numeric limits; print the
 *       configuration with the key masked. Sends no request.
 *
 *   node tools/translate/verify-llm.mjs
 *       Send one minimal chat request ("把 hello 翻译成中文", max_tokens 256) and
 *       print the HTTP status, elapsed time and returned text. 256 leaves room
 *       for the reasoning tokens a reasoning model (deepseek-v4.1-flash) emits
 *       before the answer: at 32 the budget was consumed by reasoning and
 *       `content` came back empty.
 *
 *   node tools/translate/verify-llm.mjs --quick
 *       Preflight for CI: the same request with max_tokens 8 and a short
 *       timeout, judged only on "does the provider accept this key and this
 *       money". A 2xx counts as a pass even when `content` is empty, because a
 *       reasoning model can spend the whole 8-token budget on reasoning; the
 *       question here is "will the batch die on 402/429", not "does it answer".
 *       When the HTTP status is 401, 402, 403 or 429, one machine-readable line
 *       `llm_error=<status>` is written to stdout so `.github/workflows/pages.yml`
 *       can hand the code to the deploy gate; any other failure prints no such
 *       line. `--quick` also caps the timeout at 30 s, so a preflight cannot
 *       hang for two minutes before the batch even starts.
 *
 * `--max-tokens=<n>` overrides the request budget (default 256, 8 with
 * `--quick`). `--dry-run` wins over both: nothing is sent.
 *
 * The key is never printed in full; only the first and last four characters are
 * shown. Exit code 0 means success, 1 a configuration/request failure, 2 a
 * usage error.
 */

import {
  LLMConfigError,
  LLMRequestError,
  describeLLMConfig,
  errorFromNetwork,
  errorFromResponse,
  explainLLMError,
  loadLLMConfig,
  maskSecret,
  redactUrl,
} from './lib/llm-config.mjs';

const USAGE = `Usage:
  node tools/translate/verify-llm.mjs --dry-run   # validate config, send nothing
  node tools/translate/verify-llm.mjs             # send one minimal request
  node tools/translate/verify-llm.mjs --quick     # CI preflight: max_tokens 8

  --max-tokens=<n>   output budget (default 256; 8 with --quick)

Exit 0 = OK, 1 = configuration/request failure, 2 = usage error.
With --quick, HTTP 401/402/403/429 also prints one line: llm_error=<status>.

Reads LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT_MS,
LLM_MAX_RETRIES and LLM_SESSION_ID from the environment,
<repo>/.env.local, or <workspace>/.env.local (first value wins).`;

const MAX_TOKENS_DEFAULT = 256;
/** Enough to prove auth/quota, small enough to cost almost nothing. */
const QUICK_MAX_TOKENS = 8;
/** A preflight must not be able to sit on the wire for two minutes. */
const QUICK_TIMEOUT_MS = 30000;
/** Statuses the CI gate can act on (`publish_on_llm_error`). */
const QUICK_ERROR_STATUSES = new Set([401, 402, 403, 429]);

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const quick = args.includes('--quick');

let maxTokensOverride = null;
const unknown = [];
for (const argument of args) {
  if (argument === '--dry-run' || argument === '--quick') continue;
  const override = /^--max-tokens=([0-9]+)$/.exec(argument);
  if (override) {
    maxTokensOverride = Number(override[1]);
    continue;
  }
  unknown.push(argument);
}
if (unknown.length) {
  process.stderr.write(`verify:llm: unknown argument(s): ${unknown.join(', ')}\n\n${USAGE}\n`);
  process.exit(2);
}
if (maxTokensOverride !== null && maxTokensOverride < 1) {
  process.stderr.write(`verify:llm: --max-tokens must be an integer >= 1\n\n${USAGE}\n`);
  process.exit(2);
}

const maxTokens = maxTokensOverride ?? (quick ? QUICK_MAX_TOKENS : MAX_TOKENS_DEFAULT);

function printConfiguration(config) {
  const rows = describeLLMConfig(config);
  const width = Math.max(...rows.map((row) => row.label.length));
  for (const row of rows) {
    const source = row.source === 'default' ? '' : `  [${row.source}]`;
    process.stdout.write(`${row.label.padEnd(width)} : ${row.value}${source}\n`);
  }
}

function fail(error) {
  process.stderr.write(`verify:llm: ${error.message}\n`);
  const advice = explainLLMError(error);
  if (advice) process.stderr.write(`\n${advice}\n`);
  process.exit(1);
}

let config;
try {
  config = loadLLMConfig();
} catch (error) {
  if (error instanceof LLMConfigError) fail(error);
  throw error;
}

for (const warning of config.warnings) process.stderr.write(`warning: ${warning}\n`);

process.stdout.write(`${dryRun ? 'LLM configuration (dry run)' : 'LLM configuration'}\n`);
printConfiguration(config);

if (dryRun) {
  process.stdout.write('\nOK: configuration is complete; no request was sent.\n');
  process.exit(0);
}

const timeoutMs = quick ? Math.min(config.timeoutMs, QUICK_TIMEOUT_MS) : config.timeoutMs;
const mode = quick ? ' (preflight --quick)' : '';
const sessionLabel = config.session?.value
  ? config.session.source === 'auto'
    ? 'auto'
    : config.session.value
  : '(not needed)';

process.stdout.write(
  `\nPOST ${redactUrl(config.endpoint)}${mode}\n` +
    `model=${config.model} key=${maskSecret(config.apiKey)} max_tokens=${maxTokens} ` +
    `timeout=${timeoutMs} ms session header: ${sessionLabel}\n`,
);

const started = Date.now();
let response;
let payload;
try {
  response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'User-Agent': 'mikrotik-manual-i18n/2.0 (+https://github.com/newwlfz/mikrotik_manual_i18n)',
      ...config.extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{role: 'user', content: '把 hello 翻译成中文'}],
      max_tokens: maxTokens,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  payload = await response.text();
} catch (error) {
  const failure =
    error instanceof LLMRequestError ? error : errorFromNetwork(error, {timeoutMs});
  process.stderr.write(`\nrequest failed after ${Date.now() - started} ms\n`);
  fail(failure);
}

const elapsed = Date.now() - started;
process.stdout.write(`HTTP ${response.status} in ${elapsed} ms\n`);

if (!response.ok) {
  // The CI gate reads this one line. Print it before the advice so a merged
  // stdout/stderr capture keeps the machine-readable part first.
  if (quick && QUICK_ERROR_STATUSES.has(response.status)) {
    process.stdout.write(`llm_error=${response.status}\n`);
  }
  const failure = errorFromResponse(response.status, payload);
  process.stderr.write(`\n${failure.message}\n`);
  const advice = explainLLMError(failure);
  if (advice) process.stderr.write(`\n${advice}\n`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(payload);
} catch {
  process.stderr.write('\nresponse was not JSON:\n');
  process.stderr.write(`${payload.slice(0, 500)}\n`);
  process.exit(1);
}

const choice = data.choices?.[0];
const text = choice?.message?.content;
if (!text) {
  // A reasoning model emits `reasoning_content` first and only then `content`.
  // When the output budget runs out during reasoning, `content` is empty and
  // the raw body looks successful.
  const reasoning =
    typeof choice?.message?.reasoning_content === 'string'
      ? choice.message.reasoning_content.trim()
      : '';
  if (quick) {
    // Expected here: 8 tokens is a reasoning budget, not an answer budget. The
    // preflight only asked whether the key and the balance work.
    process.stdout.write(
      `OK: LLM preflight passed — HTTP ${response.status} in ${elapsed} ms ` +
        `(auth and balance are fine; content is empty at max_tokens=${maxTokens}` +
        `${reasoning ? ', the model spent it on reasoning' : ''}).\n`,
    );
    process.exit(0);
  }
  if (reasoning) {
    process.stderr.write(
      '\nempty content: the reasoning model spent the whole max_tokens budget on reasoning\n' +
        '(推理吃掉了额度), so no answer was left. Raise max_tokens or use a non-reasoning model.\n' +
        `finish_reason=${choice?.finish_reason ?? '(none)'} max_tokens=${maxTokens}\n\n` +
        `reasoning (first 120 chars): ${reasoning.slice(0, 120)}\n`,
    );
    process.exit(1);
  }
  process.stderr.write(
    '\nresponse contains no choices[0].message.content:\n' +
      `${payload.slice(0, 500)}\n`,
  );
  process.exit(1);
}

process.stdout.write(`response: ${String(text).trim()}\n`);
if (quick) {
  process.stdout.write(
    `OK: LLM preflight passed — HTTP ${response.status} in ${elapsed} ms ` +
      `(max_tokens=${maxTokens}).\n`,
  );
}
process.exit(0);
