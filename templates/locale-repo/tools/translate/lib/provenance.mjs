/**
 * Front-matter provenance for translated overlays.
 *
 * Four keys describe who wrote the page and when:
 *
 *   translation_source     what produced THIS round's wording:
 *                          `llm` | `tm` | `memory` | `human`
 *   translated_at          ISO timestamp of the translation
 *   translation_provider   who produced the wording (`opencode-go`)
 *   translation_model      the model (`deepseek-v4.1-flash`)
 *
 * The provider is derived from the endpoint, not from a hand-written label: a
 * `LLM_BASE_URL` of `https://opencode.ai/inference/go/v1` names the OpenCode Go
 * channel, so the overlay records `opencode-go`. `config/translation.yml`'s
 * `provider` stays as the OFFLINE FALLBACK for a run with no endpoint
 * configured, and a repository may override the derivation by keeping a
 * provider whose value differs from the endpoint's name.
 *
 * The model is the configured `LLM_MODEL`; `config/translation.yml`'s `model`
 * is the OFFLINE FALLBACK, because `apply` and `derive` are offline stages and
 * must work without an API key. The config is read directly instead of through
 * `lib/provider.mjs#loadConfig` for the same reason.
 *
 * `withFields` appends these keys to an overlay's front matter; the English
 * sources never receive them.
 *
 * ## The `source` argument is the write policy
 *
 *   - `source: 'llm'` — the model rewrote the wording in THIS run. Refresh
 *     `translated_at`, `translation_provider` and `translation_model` from the
 *     current endpoint/model (env first, config fallback) even when the overlay
 *     already carries older values. This is the fix for a page that kept
 *     claiming `deepseek-v4.1-flash` after a `hy4-flash-free` run.
 *   - `source: 'tm' | 'memory' | 'human'` — the wording came from the
 *     translation memory, the model memory/shard, or a human. Keep the existing
 *     historical provider/model/time untouched; only record
 *     `translation_source`. A memory hit is NOT a fresh translation, so it must
 *     never be re-stamped as "translated today".
 *   - `source` omitted (or not one of the four values) — legacy behaviour:
 *     fill only keys that are missing and do not write `translation_source`.
 *     This keeps the offline `apply`/`derive`/`refresh` call sites byte-stable
 *     until they are explicitly wired to pass a source.
 *
 * An overlay whose `translated_at` is the date it was translated, not the date
 * this run rewrote the file, is therefore preserved on every non-LLM path.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO} from './paths.mjs';
import {peekLLMValues} from './llm-config.mjs';

// One timestamp per process: every overlay written by a run shares the same
// `translated_at`, which keeps the diff deterministic and readable.
const TRANSLATED_AT = new Date().toISOString();

let cached = null;

/**
 * A human-readable provider name from the endpoint (`opencode-go`).
 *
 * Host: the registrable label, without generic prefixes (`api.`, `www.`,
 * `llm.`). Path: the last channel-like segment, with a trailing version
 * (`v1`, `v1beta`) and the protocol words (`chat`, `completions`, `inference`)
 * removed. A loopback/IP endpoint is not a provider name, so it returns null
 * and the configured fallback is used.
 */
export function providerFromBaseUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (!host || /^[\d.]+$/.test(host) || host.includes(':') || host === 'localhost') return null;
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return null;
  const generic = new Set(['api', 'www', 'llm', 'inference', 'gateway', 'proxy']);
  const hostLabel = labels
    .slice(0, -1)
    .filter((label) => !generic.has(label.toLowerCase()))
    .pop();
  if (!hostLabel) return null;
  const skip = new Set(['api', 'chat', 'completions', 'inference', 'openai', 'v1']);
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .filter((segment) => !/^v\d+[a-z0-9]*$/i.test(segment) && !skip.has(segment.toLowerCase()));
  const channel = segments.length ? segments[segments.length - 1] : null;
  return channel ? `${hostLabel}-${channel}` : hostLabel;
}

function configValue() {
  if (cached) return cached;
  let provider = null;
  let model = null;
  // `peekLLMValues` never throws and never requires the key, so an offline
  // `apply` still works; it only lets the configured endpoint/model label the
  // output.
  const configured = peekLLMValues();
  const file = path.join(REPO, 'config/translation.yml');
  if (fs.existsSync(file)) {
    try {
      const config = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
      provider = config.provider === undefined || config.provider === null ? null : String(config.provider);
      model = config.model === undefined || config.model === null ? null : String(config.model);
    } catch {
      // A malformed provider config must not abort an offline overlay refresh;
      // the two fields are simply omitted from this run's front matter.
    }
  }
  cached = {
    provider: providerFromBaseUrl(configured.baseUrl) || provider,
    model: configured.model || model,
  };
  return cached;
}

/** True when the front matter already carries a non-empty value for `key`. */
function hasValue(frontMatter, key) {
  if (!frontMatter) return false;
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(String(frontMatter));
  if (!match) return false;
  return match[1].trim().replace(/^["']|["']$/g, '').trim() !== '';
}

/** Legal values of the `translation_source` front-matter key. */
export const TRANSLATION_SOURCES = Object.freeze(['llm', 'tm', 'memory', 'human']);

/**
 * Normalise a caller-supplied source. Unknown/empty values return null so an
 * older caller (or a typo) falls back to the legacy fill-only behaviour instead
 * of writing a bogus `translation_source` into an overlay.
 */
export function normalizeTranslationSource(source) {
  if (typeof source !== 'string') return null;
  const value = source.trim().toLowerCase();
  return TRANSLATION_SOURCES.includes(value) ? value : null;
}

/**
 * The provenance keys to write into a translated overlay.
 *
 * `existing` is the overlay's current front matter. Without `source` (or with
 * an unknown one) a key it already carries is left out of the returned map, so
 * `withFields` keeps the line byte for byte. With `source: 'llm'` the three
 * dated fields are refreshed from the current run; with a non-LLM source they
 * are kept and only `translation_source` is added/updated.
 *
 * Returns a plain `{key: value}` map for `lib/frontmatter.mjs#withFields`;
 * `null`/`undefined` values are never emitted, so a missing provider/model
 * simply leaves the old value in place.
 */
export function translationProvenance({existing = null, source = null} = {}) {
  const {provider, model} = configValue();
  const kind = normalizeTranslationSource(source);
  const rewrite = kind === 'llm';
  const values = {};
  if (rewrite || !hasValue(existing, 'translated_at')) values.translated_at = TRANSLATED_AT;
  if (rewrite || !hasValue(existing, 'translation_provider')) {
    if (provider) values.translation_provider = provider;
  }
  if (rewrite || !hasValue(existing, 'translation_model')) {
    if (model) values.translation_model = model;
  }
  if (kind) values.translation_source = kind;
  return values;
}
