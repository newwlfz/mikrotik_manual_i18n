/**
 * LLM connection settings for the translation tools.
 *
 * The endpoint, model, key and retry policy come only from `LLM_*` variables:
 *
 *   LLM_BASE_URL       required; OpenAI-compatible base URL (or a full
 *                      `/chat/completions` URL, which is used as-is)
 *   LLM_MODEL          required
 *   LLM_API_KEY        required; the only accepted key variable
 *   LLM_TIMEOUT_MS     optional; default 120000
 *   LLM_MAX_RETRIES    optional; default 3
 *   LLM_EXTRA_HEADERS  optional; JSON object of extra request headers
 *
 * Values are resolved in this order, first non-empty value wins:
 *
 *   1. `process.env`
 *   2. `<repo>/.env.local`
 *   3. `<workspace>/.env.local` (the repository's parent directory)
 *
 * A value already present in `process.env` is never overwritten by a file, so
 * CI can supply the same names as variables/secrets without a local file.
 *
 * `.env.local` supports `KEY=VALUE`, `export KEY=VALUE`, `#` comment lines,
 * single/double quoted values and trailing whitespace. The API key is never
 * printed in full: `maskSecret()` keeps the first and last four characters.
 */

import fs from 'node:fs';
import path from 'node:path';

import {REPO} from './paths.mjs';

export const ENV_FILE = '.env.local';
export const REQUIRED_VARIABLES = ['LLM_BASE_URL', 'LLM_MODEL', 'LLM_API_KEY'];
export const DEPRECATED_VARIABLES = ['OPENCODE_API_KEY'];
export const DEFAULTS = {timeoutMs: 120000, maxRetries: 3};

/** A configuration problem the caller can fix (missing variable, bad URL, ...). */
export class LLMConfigError extends Error {
  constructor(message, {code = 'missing_config', details = {}} = {}) {
    super(message);
    this.name = 'LLMConfigError';
    this.code = code;
    this.details = details;
  }
}

/** A request failure the caller may retry (or must report with advice). */
export class LLMRequestError extends Error {
  constructor(message, {code = 'http_error', status = null, retryable = false, body = null, cause = null} = {}) {
    super(message);
    this.name = 'LLMRequestError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.body = body;
    if (cause) this.cause = cause;
  }
}

function unescapeDoubleQuoted(value) {
  return value.replace(/\\([\\"nrt])/g, (_, character) =>
    ({'\\': '\\', '"': '"', n: '\n', r: '\r', t: '\t'})[character],
  );
}

/**
 * Parse one dotenv-style file. Throws `LLMConfigError` on a malformed line so a
 * typo is reported with its file and line number instead of being ignored.
 */
export function parseEnvFile(text, file = ENV_FILE) {
  const values = {};
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const [index, raw] of lines.entries()) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();

    const equals = line.indexOf('=');
    if (equals < 1) {
      throw new LLMConfigError(`${file}:${index + 1}: expected KEY=VALUE`, {
        code: 'invalid_env_file',
        details: {file, line: index + 1},
      });
    }

    const key = line.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new LLMConfigError(`${file}:${index + 1}: invalid variable name "${key}"`, {
        code: 'invalid_env_file',
        details: {file, line: index + 1},
      });
    }

    let value = line.slice(equals + 1).trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      let end = -1;
      for (let cursor = 1; cursor < value.length; cursor++) {
        if (quote === '"' && value[cursor] === '\\') {
          cursor++;
          continue;
        }
        if (value[cursor] === quote) {
          end = cursor;
          break;
        }
      }
      if (end === -1) {
        throw new LLMConfigError(`${file}:${index + 1}: unterminated ${quote} quote`, {
          code: 'invalid_env_file',
          details: {file, line: index + 1},
        });
      }
      const trailing = value.slice(end + 1).trim();
      if (trailing && !trailing.startsWith('#')) {
        throw new LLMConfigError(`${file}:${index + 1}: unexpected text after closing quote`, {
          code: 'invalid_env_file',
          details: {file, line: index + 1},
        });
      }
      value = value.slice(1, end);
      if (quote === '"') value = unescapeDoubleQuoted(value);
    } else {
      // An unquoted `#` starts a comment only when preceded by whitespace, so
      // values such as `model#tag` survive.
      const comment = value.search(/\s#/);
      if (comment !== -1) value = value.slice(0, comment).trimEnd();
    }

    values[key] = value;
  }

  return values;
}

function readFileIfPresent(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/**
 * Merge `process.env`, `<repo>/.env.local` and `<workspace>/.env.local`.
 * Returns a `get(name)` lookup that also reports where the value came from,
 * plus the files that were actually read and the files that were searched.
 */
export function discoverLLMValues({repoRoot = REPO, workspaceRoot = path.resolve(repoRoot, '..'), env = process.env} = {}) {
  const searchedFiles = [path.join(repoRoot, ENV_FILE), path.join(workspaceRoot, ENV_FILE)];
  const files = [];

  for (const file of searchedFiles) {
    const text = readFileIfPresent(file);
    if (text !== null) files.push({file, values: parseEnvFile(text, file)});
  }

  const get = (name) => {
    const direct = env[name];
    if (direct !== undefined && direct !== '') return {value: direct, source: 'environment'};
    for (const {file, values} of files) {
      if (values[name] !== undefined && values[name] !== '') return {value: values[name], source: file};
    }
    return {value: undefined, source: null};
  };

  return {get, files, searchedFiles};
}

/**
 * Normalize `LLM_BASE_URL` into `{baseUrl, endpoint}`.
 *
 * `https://host` and `https://host/v1` both become
 * `https://host/v1/chat/completions`; a URL that already names the
 * chat-completions path is not suffixed twice; trailing slashes are ignored.
 */
export function normalizeBaseUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    throw new LLMConfigError('LLM_BASE_URL is empty', {code: 'invalid_base_url'});
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new LLMConfigError(`LLM_BASE_URL is not a valid URL: ${redactUrl(text)}`, {
      code: 'invalid_base_url',
    });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new LLMConfigError(`LLM_BASE_URL must use http or https (got ${url.protocol})`, {
      code: 'invalid_base_url',
    });
  }
  if (url.search || url.hash) {
    throw new LLMConfigError('LLM_BASE_URL must not contain a query string or fragment', {
      code: 'invalid_base_url',
    });
  }

  const base = new URL(url.toString());
  base.pathname = url.pathname.replace(/\/+$/, '') || '/';
  const baseUrl = base.toString().replace(/\/$/, '');

  let pathname = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(pathname)) {
    // Already the full endpoint.
  } else if (/\/v1$/i.test(pathname)) {
    pathname += '/chat/completions';
  } else {
    pathname += '/v1/chat/completions';
  }

  const endpoint = new URL(url.toString());
  endpoint.pathname = pathname;
  endpoint.search = '';
  endpoint.hash = '';

  return {baseUrl, endpoint: endpoint.toString()};
}

function readPositiveInteger(name, raw, fallback, {allowZero = false} = {}) {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum) {
    throw new LLMConfigError(`${name} must be an integer >= ${minimum} (got "${raw}")`, {
      code: 'invalid_value',
      details: {variable: name, value: raw},
    });
  }
  return value;
}

function parseExtraHeaders(raw) {
  if (raw === undefined || raw === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new LLMConfigError(`LLM_EXTRA_HEADERS is not valid JSON: ${error.message}`, {
      code: 'invalid_extra_headers',
    });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LLMConfigError('LLM_EXTRA_HEADERS must be a JSON object, e.g. {"X-Org":"team"}', {
      code: 'invalid_extra_headers',
    });
  }

  const headers = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (!name || /[\r\n]/.test(name)) {
      throw new LLMConfigError('LLM_EXTRA_HEADERS contains an invalid header name', {
        code: 'invalid_extra_headers',
      });
    }
    if (!['string', 'number', 'boolean'].includes(typeof value) || /[\r\n]/.test(String(value))) {
      throw new LLMConfigError(`LLM_EXTRA_HEADERS["${name}"] must be a single-line string`, {
        code: 'invalid_extra_headers',
      });
    }
    headers[name] = String(value);
  }

  const authorization = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  if (authorization) {
    throw new LLMConfigError('LLM_EXTRA_HEADERS must not set Authorization; use LLM_API_KEY', {
      code: 'invalid_extra_headers',
    });
  }

  return headers;
}

/** Keep only the first and last four characters of a secret. */
export function maskSecret(value) {
  if (!value) return '(not set)';
  const text = String(value);
  if (text.length <= 8) return `${'*'.repeat(text.length)} (${text.length} chars)`;
  return `${text.slice(0, 4)}…${text.slice(-4)} (${text.length} chars)`;
}

/** Hide userinfo and any query values before a URL is logged. */
export function redactUrl(value) {
  const text = String(value ?? '');
  try {
    const url = new URL(text);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString().replace(/\/$/, '');
  } catch {
    return text.replace(/([?&](?:key|token|api_key|access_token)=)[^&]*/gi, '$1***');
  }
}

/**
 * Read the LLM configuration, or throw an actionable `LLMConfigError`.
 *
 * The returned object keeps the source of every value so `verify:llm` can show
 * exactly which file (or `environment`) supplied it.
 */
export function loadLLMConfig(options = {}) {
  const {repoRoot = REPO, workspaceRoot = path.resolve(repoRoot, '..'), env = process.env} = options;
  const {get, searchedFiles} = discoverLLMValues({repoRoot, workspaceRoot, env});

  const missing = REQUIRED_VARIABLES.filter((name) => {
    const value = get(name).value;
    return value === undefined || String(value).trim() === '';
  });
  const deprecated = DEPRECATED_VARIABLES.filter((name) => {
    const value = get(name).value;
    return value !== undefined && String(value).trim() !== '';
  });

  if (missing.length) {
    const lines = [
      `missing required LLM configuration: ${missing.join(', ')}`,
      'Set it in the environment, in the repository .env.local, or in the workspace .env.local:',
      ...searchedFiles.map((file) => `  - ${file}`),
      'Copy .env.local.example to .env.local and fill in the values; never commit it.',
    ];
    if (deprecated.length) {
      lines.push(
        `note: ${deprecated.join(', ')} is deprecated (已弃用，请改名); rename it to LLM_API_KEY.`,
      );
    }
    throw new LLMConfigError(lines.join('\n'), {
      code: 'missing_config',
      details: {missing, searchedFiles, deprecated},
    });
  }

  const sources = {};
  const valueOf = (name) => {
    const found = get(name);
    sources[name] = found.source;
    return found.value === undefined ? undefined : String(found.value).trim();
  };

  const rawBaseUrl = valueOf('LLM_BASE_URL');
  const model = valueOf('LLM_MODEL');
  const apiKey = valueOf('LLM_API_KEY');
  const rawTimeout = valueOf('LLM_TIMEOUT_MS');
  const rawRetries = valueOf('LLM_MAX_RETRIES');
  const rawHeaders = valueOf('LLM_EXTRA_HEADERS');

  const {baseUrl, endpoint} = normalizeBaseUrl(rawBaseUrl);
  const timeoutMs = readPositiveInteger('LLM_TIMEOUT_MS', rawTimeout, DEFAULTS.timeoutMs);
  const maxRetries = readPositiveInteger('LLM_MAX_RETRIES', rawRetries, DEFAULTS.maxRetries, {
    allowZero: true,
  });
  const extraHeaders = parseExtraHeaders(rawHeaders);

  const warnings = deprecated.map(
    (name) => `${name} is set but deprecated (已弃用，请改名); use LLM_API_KEY instead.`,
  );

  return {
    baseUrl,
    endpoint,
    model,
    apiKey,
    timeoutMs,
    maxRetries,
    extraHeaders,
    sources,
    warnings,
    envFiles: searchedFiles.filter((file) => fs.existsSync(file)),
  };
}

/** Non-throwing read of the model/base URL, used to label offline provenance. */
export function peekLLMValues(options = {}) {
  try {
    const {repoRoot = REPO, workspaceRoot = path.resolve(repoRoot, '..'), env = process.env} = options;
    const {get} = discoverLLMValues({repoRoot, workspaceRoot, env});
    const pick = (name) => {
      const value = get(name).value;
      return value === undefined ? null : String(value).trim() || null;
    };
    return {baseUrl: pick('LLM_BASE_URL'), model: pick('LLM_MODEL')};
  } catch {
    return {baseUrl: null, model: null};
  }
}

/** Human-readable rows for `verify:llm --dry-run`; no secret is ever returned. */
export function describeLLMConfig(config) {
  const source = (key) => config.sources?.[key] || 'default';
  return [
    {label: 'base URL', value: redactUrl(config.baseUrl), source: source('LLM_BASE_URL')},
    {label: 'endpoint', value: redactUrl(config.endpoint), source: 'derived'},
    {label: 'model', value: config.model, source: source('LLM_MODEL')},
    {label: 'API key', value: maskSecret(config.apiKey), source: source('LLM_API_KEY')},
    {label: 'timeout', value: `${config.timeoutMs} ms`, source: source('LLM_TIMEOUT_MS')},
    {label: 'max retries', value: String(config.maxRetries), source: source('LLM_MAX_RETRIES')},
    {
      label: 'extra headers',
      value: Object.keys(config.extraHeaders).join(', ') || '(none)',
      source: source('LLM_EXTRA_HEADERS'),
    },
  ];
}

const STATUS_CODES = {
  401: 'unauthorized',
  402: 'payment_required',
  403: 'forbidden',
  404: 'not_found',
  408: 'timeout',
  429: 'rate_limited',
};

/** Build a typed error from a non-2xx provider response. */
export function errorFromResponse(status, body = '') {
  const code = STATUS_CODES[status] || (status >= 500 ? 'server_error' : 'http_error');
  const retryable = code === 'rate_limited' || code === 'server_error' || code === 'timeout';
  const text = String(body ?? '').slice(0, 500);
  const detail = text.replace(/\s+/g, ' ').trim();
  return new LLMRequestError(`HTTP ${status}${detail ? `: ${detail}` : ''}`, {
    code,
    status,
    retryable,
    body: text,
  });
}

/** Build a typed error from a fetch failure, distinguishing timeouts. */
export function errorFromNetwork(error, {timeoutMs} = {}) {
  const name = error?.name || '';
  const message = error?.message || String(error);
  const timeout = name === 'TimeoutError' || name === 'AbortError' || /timed? ?out|aborted/i.test(message);
  return new LLMRequestError(
    timeout ? `request timed out after ${timeoutMs ?? '?'} ms` : `network error: ${message}`,
    {
      code: timeout ? 'timeout' : 'network',
      retryable: true,
      cause: error,
    },
  );
}

/** Actionable next step for a configuration or request failure. */
export function explainLLMError(error) {
  if (!error) return '';
  if (error instanceof LLMConfigError) {
    if (error.code === 'missing_config') {
      return [
        'Required variables: LLM_BASE_URL, LLM_MODEL, LLM_API_KEY.',
        'Set them in the environment (CI variables/secrets), in <repo>/.env.local, or in <workspace>/.env.local.',
        'Copy .env.local.example to .env.local, fill in the values, and do not commit the result.',
      ].join('\n');
    }
    if (error.code === 'invalid_base_url') {
      return [
        'LLM_BASE_URL must be an http(s) URL without a query string, for example:',
        '  https://api.deepseek.com/v1   or   https://opencode.ai/zen/v1',
        'A URL ending in /chat/completions is used as-is.',
      ].join('\n');
    }
    return error.message;
  }

  switch (error.code) {
    case 'unauthorized':
      return [
        'The API key was rejected (401).',
        'Check LLM_API_KEY: it must be the current key for LLM_BASE_URL, without quotes or trailing spaces.',
        'If the key was rotated, update the GitHub Actions secret as well.',
      ].join('\n');
    case 'payment_required':
      return [
        'The provider accepted the key but the account cannot pay for the request (402).',
        'Top up the account balance, or point LLM_BASE_URL/LLM_API_KEY at a funded provider.',
      ].join('\n');
    case 'forbidden':
      return [
        'The key is valid but not allowed to use this model (403).',
        'Check the key permissions and that LLM_MODEL is enabled for this account.',
      ].join('\n');
    case 'not_found':
      return [
        'Endpoint or model not found (404).',
        'Check LLM_BASE_URL: it must be the provider\'s OpenAI-compatible base URL (usually ending in /v1).',
        'Check LLM_MODEL: use the exact model id shown by the provider.',
      ].join('\n');
    case 'rate_limited':
      return [
        'The provider is rate limiting this key (429).',
        'Wait and retry, lower the request rate (smaller batches), or raise LLM_MAX_RETRIES.',
      ].join('\n');
    case 'server_error':
      return 'The provider returned a 5xx error. Retry later; raise LLM_MAX_RETRIES for transient failures.';
    case 'timeout':
      return 'The request did not finish in time. Raise LLM_TIMEOUT_MS if the provider is slow, then retry.';
    case 'network':
      return 'The provider could not be reached. Check LLM_BASE_URL, DNS/network access and any proxy settings.';
    default:
      return '';
  }
}
