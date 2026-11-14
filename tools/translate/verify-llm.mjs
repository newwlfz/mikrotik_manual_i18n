#!/usr/bin/env node
/**
 * Check the LLM connection used by `tools/translate`.
 *
 *   node tools/translate/verify-llm.mjs --dry-run
 *       Validate the variables, the URL shape and the numeric limits; print the
 *       configuration with the key masked. Sends no request.
 *
 *   node tools/translate/verify-llm.mjs
 *       Send one minimal chat request ("把 hello 翻译成中文", max_tokens 32) and
 *       print the HTTP status, elapsed time and returned text.
 *
 * The key is never printed in full; only the first and last four characters are
 * shown. Exit code 0 means success, 1 a configuration/request failure.
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

Reads LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT_MS and
LLM_MAX_RETRIES from the environment, <repo>/.env.local, or
<workspace>/.env.local (first value wins).`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const unknown = args.filter((argument) => argument !== '--dry-run');
if (unknown.length) {
  process.stderr.write(`verify:llm: unknown argument(s): ${unknown.join(', ')}\n\n${USAGE}\n`);
  process.exit(2);
}

const dryRun = args.includes('--dry-run');

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

process.stdout.write(
  `\nPOST ${redactUrl(config.endpoint)}\n` +
    `model=${config.model} key=${maskSecret(config.apiKey)} max_tokens=32\n`,
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
      max_tokens: 32,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  payload = await response.text();
} catch (error) {
  const failure =
    error instanceof LLMRequestError ? error : errorFromNetwork(error, {timeoutMs: config.timeoutMs});
  process.stderr.write(`\nrequest failed after ${Date.now() - started} ms\n`);
  fail(failure);
}

const elapsed = Date.now() - started;
process.stdout.write(`HTTP ${response.status} in ${elapsed} ms\n`);

if (!response.ok) {
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

const text = data.choices?.[0]?.message?.content;
if (!text) {
  process.stderr.write('\nresponse contains no choices[0].message.content:\n');
  process.stderr.write(`${payload.slice(0, 500)}\n`);
  process.exit(1);
}

process.stdout.write(`response: ${String(text).trim()}\n`);
process.exit(0);
