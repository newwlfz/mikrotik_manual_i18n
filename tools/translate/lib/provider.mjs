/**
 * OpenAI-compatible chat client for the translation batches.
 *
 * Only the units the overlay still has in English are ever sent, which keeps a
 * run small and resumable.
 *
 * Endpoint, model, API key, timeout and retry budget come from `LLM_*` through
 * `lib/llm-config.mjs`; they are never written to the repository.
 * `config/translation.yml` keeps the non-secret translation policy (glossary,
 * batch segmentation, temperature, provenance label).
 *
 * The prompt is not one constant any more. It is assembled from three inputs:
 *
 *   1. the generic translation contract below (structure, identifiers, output
 *      format), which is the same for every language;
 *   2. the locale profile (`config/locale-profiles/<locale>.md`, read by
 *      `lib/locale-profile.mjs`): script, register, punctuation, preferred
 *      wording and one bad/good example pair per recurring mistake;
 *   3. the glossary terms that actually occur in the text being sent, at most
 *      `glossary_limit` of them (default 20), so a batch prompt carries the
 *      relevant terminology instead of the whole glossary.
 *
 * `system(text)` therefore depends on the text: the same client sends a
 * different terminology block for a firewall page and a routing page.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO, WORK_DIR, DEFAULT_TARGET_LOCALE, ensureDir} from './paths.mjs';
import {segmentation} from './segments.mjs';
import {profileFor} from './locale-profile.mjs';
import {
  LLMRequestError,
  errorFromNetwork,
  errorFromResponse,
  loadLLMConfig,
} from './llm-config.mjs';

/** Default cap on glossary terms quoted in one request. */
export const GLOSSARY_LIMIT = 20;

/** Human name of a writing system, for the prompt. */
function scriptName(script) {
  if (script === 'Hans') return 'Simplified Chinese';
  if (script === 'Hant') return 'Traditional Chinese';
  return 'Latin';
}

/**
 * The glossary of one locale, or none.
 *
 * The file is `config/glossary/<locale>.yml`. `config/translation.yml#glossary`
 * is a per-repository default (the language this checkout translates into), and
 * is used only when it names the same locale — asking for `en` must not inject
 * the Simplified Chinese glossary into an English prompt.
 */
function loadGlossary(locale, config) {
  const own = path.join(REPO, 'config/glossary', `${locale}.yml`);
  const configured = config.glossary ? path.join(REPO, config.glossary) : null;
  const fallback =
    configured && path.basename(configured) === `${locale}.yml` && fs.existsSync(configured)
      ? configured
      : null;
  const file = fs.existsSync(own) ? own : fallback;
  if (!file) return [];
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return Array.isArray(parsed.terms) ? parsed.terms : [];
}

/**
 * Everything the prompt needs, and nothing that needs a secret.
 *
 * Split out of `loadConfig()` so the selftest (and any offline reviewer) can
 * build a prompt without `LLM_*` being set; only the wire client needs those.
 */
export function loadPromptConfig(locale = DEFAULT_TARGET_LOCALE) {
  const config = YAML.parse(fs.readFileSync(path.join(REPO, 'config/translation.yml'), 'utf8')) || {};
  return {
    locale,
    profile: profileFor(locale),
    glossary: loadGlossary(locale, config),
    glossaryLimit: Number(config.glossary_limit ?? GLOSSARY_LIMIT),
    temperature: config.temperature ?? 0,
    provider: config.provider || 'openai-compatible',
    segmentation: segmentation(config),
  };
}

export function loadConfig(locale = DEFAULT_TARGET_LOCALE) {
  const prompt = loadPromptConfig(locale);
  const llm = loadLLMConfig();
  for (const warning of llm.warnings) process.stderr.write(`warning: ${warning}\n`);

  return {
    ...prompt,
    // Provenance label written to `translation_provider`; the wire protocol is
    // always OpenAI chat-completions, so it is not used to select a client.
    model: llm.model,
    baseUrl: llm.endpoint,
    apiKey: llm.apiKey,
    // Segmentation is policy, not a flag: one request carries at most
    // `max_blocks` blocks and `max_chars` characters (config/translation.yml).
    batchSize: prompt.segmentation.maxBlocks,
    maxChars: prompt.segmentation.maxChars,
    maxRetries: llm.maxRetries,
    timeoutMs: llm.timeoutMs,
    extraHeaders: llm.extraHeaders,
  };
}

/** Escape a term for a regular expression. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Where `source` first occurs in `text`, or -1.
 *
 * ASCII terms match as whole words (with a plural suffix), so `interface` does
 * not match `interfaces` only by luck and `IP` does not match `IPsec`. A term
 * that contains non-ASCII text is matched literally: it is already the target
 * wording or a CJK name.
 */
function firstOccurrence(text, source) {
  if (/^[\x20-\x7e]+$/.test(source)) {
    const pattern = new RegExp(
      `(^|[^A-Za-z0-9_])${escapeRegExp(source)}(?:s|es)?(?=$|[^A-Za-z0-9_])`,
      'i',
    );
    const match = pattern.exec(text);
    return match ? match.index + match[1].length : -1;
  }
  return text.indexOf(source);
}

/**
 * The glossary terms that occur in one unit of text, at most `limit`.
 *
 * The order is deliberate: terms whose wording actually changes first (they are
 * the ones the model must get right), then terms that must stay as written
 * (`RouterOS → RouterOS`), both in the order they occur. A batch prompt about
 * firewalls then carries `firewall`/`packet`/`queue` and not the entire file.
 */
export function relevantTerms(terms, text, limit = GLOSSARY_LIMIT) {
  const haystack = String(text ?? '');
  if (!haystack.trim() || !Array.isArray(terms) || limit <= 0) return [];
  const found = [];
  for (const term of terms) {
    const source = String(term?.source ?? '').trim();
    if (!source) continue;
    const target = String(term?.target ?? '').trim() || source;
    const at = firstOccurrence(haystack, source);
    if (at === -1) continue;
    found.push({source, target, at, identity: target === source});
  }
  found.sort(
    (a, b) =>
      Number(a.identity) - Number(b.identity) ||
      a.at - b.at ||
      b.source.length - a.source.length,
  );
  return found.slice(0, limit).map(({source, target}) => ({source, target}));
}

/** The generic contract, parameterised by the locale profile. */
export function baseSystem(profile) {
  const language = profile.label;
  const parts = [
    `You translate MikroTik RouterOS documentation from English into ${language} ` +
      `(locale ${profile.locale}, ${scriptName(profile.script)} script).`,
    `Target language: ${language}. Writing system: ${scriptName(profile.script)} script.` +
      (profile.register ? ` Register: ${profile.register}.` : '') +
      (profile.punctuation ? ` Punctuation: ${profile.punctuation}.` : ''),
    'Output contract:\n' +
      '- Return ONLY the translation: no preface, no explanation, no notes, and no code fence around the answer.\n' +
      '- The style, wording, terminology and phrase order must follow this locale\'s documentation conventions; never translate word for word when the locale would phrase it differently.',
    'Rules, in order of importance:\n' +
      '1. Preserve block structure exactly: the same headings, the same list markers, the same table rows,\n' +
      '   the same paragraph boundaries, the same number of blank-line separated blocks.\n' +
      '2. Reproduce every HTML/MDX tag and attribute character for character.\n' +
      '3. Translate prose only: headings, paragraphs, list items, table cells, image alt text.\n' +
      '4. Never translate identifiers: CLI commands, menu paths, parameter and property names, enum\n' +
      '   values, flags, protocol and product names, RouterOS and MikroTik, anything in backticks,\n' +
      '   and anything written in kebab-case, snake_case or camelCase.\n' +
      '5. Fenced code blocks are copied verbatim, including the fence lines.\n' +
      '6. Keep code, commands, file paths, anchors, URLs and product names exactly as written.\n' +
      '7. Quotes inside prose stay balanced; never introduce a line that starts with the bare words\n' +
      '   import or export outside a fence.\n' +
      '8. Keep the same number of blocks. If the input has N blocks, the output has N blocks.',
  ];
  return parts.join('\n\n');
}

/** The parsed locale profile, rendered as prompt text. */
export function profileSection(profile) {
  const separator = profile.script === 'Latn' ? '; ' : '；';
  const lines = [`Locale profile — ${profile.label} (${profile.locale}):`];
  if (profile.script) lines.push(`- script: ${profile.script} (${scriptName(profile.script)})`);
  if (profile.register) lines.push(`- register: ${profile.register}`);
  if (profile.punctuation) lines.push(`- punctuation: ${profile.punctuation}`);
  if (profile.keepVerbatim) lines.push(`- keep verbatim: ${profile.keepVerbatim}`);
  if (profile.preferredTerms.length) {
    lines.push(`- preferred terms: ${profile.preferredTerms.join(separator)}`);
  }
  for (const example of profile.examples) {
    if (example.bad) lines.push(`- example, wrong: ${example.bad}`);
    if (example.good) lines.push(`- example, correct: ${example.good}`);
  }
  return lines.join('\n');
}

/** The "this locale, not the other one" reminder. */
export function scriptGuardSection(profile) {
  if (profile.script === 'Hant') {
    return (
      'Writing system: Traditional Chinese as used in Taiwan (臺灣正體). Never output Simplified ' +
      'characters or mainland wording (软件, 网络, 设置, 用户, 服务器, 队列, 接口, 打印, 视频 …); ' +
      'use the Traditional equivalents from the locale profile (軟體, 網路, 設定, 使用者, 伺服器, ' +
      '佇列, 介面, 列印, 影片 …).'
    );
  }
  if (profile.script === 'Hans') {
    return (
      'Writing system: Simplified Chinese as used in mainland China. Never output Traditional ' +
      'characters or Taiwan wording (軟體, 網路, 設定, 使用者, 伺服器, 佇列, 介面, 列印, 影片 …); ' +
      'use the simplified equivalents from the locale profile (软件, 网络, 设置, 用户, 服务器, ' +
      '队列, 接口, 打印, 视频 …).'
    );
  }
  return 'Writing system: Latin script; write natural English technical prose.';
}

/** The relevant glossary slice, rendered as prompt text. */
export function glossarySection(terms) {
  const lines = [
    'Terminology for this passage (use these established translations; terms listed as identical stay as written):',
  ];
  for (const term of terms) {
    lines.push(`- ${term.source} → ${term.target}`);
  }
  return lines.join('\n');
}

export class Client {
  constructor(config) {
    this.config = config;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'User-Agent': 'mikrotik-manual-i18n/2.0 (+https://github.com/newwlfz/mikrotik_manual_i18n)',
      ...config.extraHeaders,
    };
    this.usage = {prompt: 0, completion: 0, calls: 0};
  }

  /** The profile of this client's locale (never null, even without a file). */
  profile() {
    return this.config.profile || profileFor(this.config.locale || DEFAULT_TARGET_LOCALE);
  }

  /**
   * The system prompt for one request.
   *
   * `text` is the user content that will be sent; it decides which glossary
   * terms are quoted. Passing nothing yields the rules and the profile only.
   */
  system(text = '') {
    const profile = this.profile();
    const parts = [baseSystem(profile), profileSection(profile), scriptGuardSection(profile)];
    const terms = relevantTerms(
      this.config.glossary || [],
      text,
      Number(this.config.glossaryLimit ?? GLOSSARY_LIMIT),
    );
    if (terms.length) parts.push(glossarySection(terms));
    return parts.filter(Boolean).join('\n\n');
  }

  async chat(user, {retries = this.config.maxRetries, system} = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(this.config.baseUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              {role: 'system', content: system || this.system(user)},
              {role: 'user', content: user},
            ],
            temperature: this.config.temperature,
          }),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        const payload = await response.text();
        if (!response.ok) {
          // 401/402/403/404 are fatal; 408/429/5xx are retryable (see
          // `LLMRequestError.retryable`).
          throw errorFromResponse(response.status, payload);
        }

        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          throw new LLMRequestError('provider returned a non-JSON body', {
            code: 'invalid_response',
            retryable: true,
            body: payload.slice(0, 300),
          });
        }

        const choice = data.choices?.[0];
        if (!choice?.message?.content) {
          throw new LLMRequestError('provider response has no content', {
            code: 'invalid_response',
            retryable: true,
          });
        }
        this.usage.prompt += data.usage?.prompt_tokens || 0;
        this.usage.completion += data.usage?.completion_tokens || 0;
        this.usage.calls++;
        if (choice.finish_reason === 'length') {
          throw new LLMRequestError('response truncated at the output limit', {
            code: 'truncated',
            retryable: true,
          });
        }
        return choice.message.content.trim();
      } catch (error) {
        const failure =
          error instanceof LLMRequestError
            ? error
            : errorFromNetwork(error, {timeoutMs: this.config.timeoutMs});
        lastError = failure;
        if (!failure.retryable) throw failure;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  log(file) {
    ensureDir(path.dirname(file));
    fs.appendFileSync(
      file,
      `${JSON.stringify({at: new Date().toISOString(), provider: this.config.provider, model: this.config.model, ...this.usage})}\n`,
    );
  }
}

export const USAGE_FILE = path.join(WORK_DIR, 'usage.jsonl');
