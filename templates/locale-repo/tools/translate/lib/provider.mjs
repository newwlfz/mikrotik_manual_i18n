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
import {productNameRule} from './prompts.mjs';
import {
  LLMRequestError,
  errorFromNetwork,
  errorFromResponse,
  loadLLMConfig,
} from './llm-config.mjs';

/** Default cap on glossary terms quoted in one request. */
export const GLOSSARY_LIMIT = 20;

/**
 * `config/translation.yml#reasoning` policy to wire parameter.
 *
 * `null` means "send nothing", which is the endpoint's own default (a reasoning
 * model then thinks before every answer). `off` is what this repository ships
 * with: on the same 8-block request it kept the wording and cut completion
 * tokens from ~1 000 to ~310, because `reasoning_content` is discarded by this
 * pipeline anyway — only `content` is the translation. The measurement table is
 * in `config/translation.yml`.
 */
export const REASONING_POLICIES = Object.freeze({
  off: 'none',
  low: 'low',
  minimal: 'minimal',
  default: null,
});

export const DEFAULT_REASONING = 'off';

/** Output budget of one request when the config omits `max_tokens`. */
export const DEFAULT_MAX_TOKENS = 4096;

/**
 * Sampling temperature of one request when the config omits `temperature`.
 *
 * `0` is the translation policy, not a taste: the same English paragraph is sent
 * by three version trees (`docs`, `docs-7.25`, `docs-7.24`), and at the endpoint's
 * default temperature the three answers differed word for word for the same
 * source text. Zero makes the answer a function of the prompt, which is what the
 * translation memory and `apply` assume; the TM lookup before the queue (see
 * `tools/translate/index.mjs`) removes most of the duplication, and this removes
 * the rest of the variance for the blocks that are still paid for.
 */
export const DEFAULT_TEMPERATURE = 0;

/** Validate `config/translation.yml#temperature`, or explain what it accepts. */
export function normalizeTemperature(value) {
  if (value === undefined || value === null) return DEFAULT_TEMPERATURE;
  const temperature = Number(value);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error(
      `config/translation.yml#temperature must be a number between 0 and 2 (got "${value}")`,
    );
  }
  return temperature;
}

/** Validate `config/translation.yml#reasoning`, or explain what it accepts. */
export function normalizeReasoning(value) {
  const policy = String(value ?? DEFAULT_REASONING).trim().toLowerCase();
  if (!Object.hasOwn(REASONING_POLICIES, policy)) {
    throw new Error(
      'config/translation.yml#reasoning must be one of ' +
        `${Object.keys(REASONING_POLICIES).join(', ')} (got "${value}")`,
    );
  }
  return policy;
}

/** Validate `config/translation.yml#max_tokens`, or explain what it accepts. */
export function normalizeMaxTokens(value) {
  if (value === undefined || value === null) return DEFAULT_MAX_TOKENS;
  const tokens = Number(value);
  if (!Number.isInteger(tokens) || tokens < 64) {
    throw new Error(`config/translation.yml#max_tokens must be an integer >= 64 (got "${value}")`);
  }
  return tokens;
}

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
    temperature: normalizeTemperature(config.temperature),
    // Policy of the request body: how much the model may think before answering
    // and how long that answer may be. All three are validated here, so a typo is
    // reported once, before the first request, not once per block.
    reasoning: normalizeReasoning(config.reasoning),
    maxTokens: normalizeMaxTokens(config.max_tokens),
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
      '6. Keep code, commands, file paths, URLs and product names exactly as written.\n' +
      '   Copy heading anchors `{#id}` and URL fragments `#fragment` byte for byte: never\n' +
      '   translate them, drop them, change their case, or invent a new one. An anchor or\n' +
      '   fragment rewritten into the target script silently breaks internal links.\n' +
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

/**
 * The wrong→right wording tables from `script-check.mjs`, the single source.
 *
 * That module keeps `HANT_WORDS` / `HANS_WORDS` module-private because they drive
 * the offline output check, not a public API. The LLM guard must quote the very
 * same pairs, so rather than keep a second list that drifts we read the literal
 * from that file at load time. One edit to the checker updates both the retry
 * feedback and every system prompt.
 */
function localeWordPairs(name) {
  const source = fs.readFileSync(new URL('./script-check.mjs', import.meta.url), 'utf8');
  const block = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`).exec(source);
  if (!block) throw new Error(`script-check.mjs: cannot read ${name} for the LLM guard`);
  const pairs = [];
  const entry = /\{\s*from:\s*'([^']+)'\s*,\s*to:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = entry.exec(block[1]))) pairs.push({from: match[1], to: match[2]});
  if (!pairs.length) throw new Error(`script-check.mjs: ${name} is empty; the LLM guard must not be empty`);
  return pairs;
}

export const HANT_GUARD_WORDS = localeWordPairs('HANT_WORDS');
export const HANS_GUARD_WORDS = localeWordPairs('HANS_WORDS');

/** One column of a wording table, de-duplicated and in table order. */
function wordColumn(words, column) {
  return [...new Set(words.map((word) => word[column]))].join(', ');
}

/** The "this locale, not the other one" reminder. */
export function scriptGuardSection(profile) {
  if (profile.script === 'Hant') {
    return (
      'Writing system: Traditional Chinese as used in Taiwan (臺灣正體). Never output Simplified ' +
      `characters or mainland wording (${wordColumn(HANT_GUARD_WORDS, 'from')}); ` +
      `use the Traditional equivalents from the locale profile (${wordColumn(HANT_GUARD_WORDS, 'to')}).`
    );
  }
  if (profile.script === 'Hans') {
    return (
      'Writing system: Simplified Chinese as used in mainland China. Never output Traditional ' +
      `characters or Taiwan wording (${wordColumn(HANS_GUARD_WORDS, 'from')}); ` +
      `use the simplified equivalents from the locale profile (${wordColumn(HANS_GUARD_WORDS, 'to')}).`
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
    // Request policy (config/translation.yml). A direct `new Client({...})` in a
    // test or a script may omit both; the shipped defaults apply then, so the
    // body a mock sees is the body a batch sends.
    this.reasoning = normalizeReasoning(config.reasoning);
    this.maxTokens = normalizeMaxTokens(config.maxTokens);
    this.temperature = normalizeTemperature(config.temperature);
    // Set only after a 400 that names the parameter: the endpoint does not
    // implement it, so it is omitted for the rest of this client's life.
    this.dropReasoning = false;
    this.dropMaxTokens = false;
    this.dropTemperature = false;
  }

  /** The `reasoning_effort` value this client sends, or null for none. */
  wireReasoning() {
    return REASONING_POLICIES[normalizeReasoning(this.reasoning)];
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
    const parts = [
      baseSystem(profile),
      // Product/model examples are data from the glossary + heading policy, not
      // a hardcoded list in the prompt. Appended to every request so a title,
      // label, description or block gets the same "model names stay verbatim"
      // rule, including batches where no glossary term occurs in the text.
      productNameRule(this.config.locale || DEFAULT_TARGET_LOCALE),
      profileSection(profile),
      scriptGuardSection(profile),
    ];
    const terms = relevantTerms(
      this.config.glossary || [],
      text,
      Number(this.config.glossaryLimit ?? GLOSSARY_LIMIT),
    );
    if (terms.length) parts.push(glossarySection(terms));
    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * The JSON body of one request.
   *
   * `temperature`, `max_tokens` and `reasoning_effort` are policy, not flags:
   * they come from `config/translation.yml` and are the same for every call of a
   * batch, so a logged run can be replayed. `reasoning: default` sends no
   * reasoning field at all, which is what the endpoint did before this was
   * configurable; an endpoint that rejects one of the three fields is retried
   * once without it (see `dropRejectedParameter`).
   */
  requestBody(user, system) {
    const body = {
      model: this.config.model,
      messages: [
        {role: 'system', content: system || this.system(user)},
        {role: 'user', content: user},
      ],
    };
    if (!this.dropTemperature) body.temperature = this.temperature;
    if (this.maxTokens && !this.dropMaxTokens) body.max_tokens = this.maxTokens;
    const effort = this.wireReasoning();
    if (effort && !this.dropReasoning) body.reasoning_effort = effort;
    return body;
  }

  /**
   * Drop one policy parameter the endpoint said it does not know.
   *
   * A 400 whose body names `temperature` (or `reasoning_effort`, or
   * `max_tokens`) means this provider implements none of them, so the field is
   * omitted and the request is repeated. Only those three fields are ever
   * dropped, each once; anything else stays a hard failure, so a real
   * configuration error is not hidden behind a silent downgrade.
   */
  dropRejectedParameter(failure) {
    if (failure?.status !== 400) return false;
    const text = String(failure.body || '');
    if (!this.dropReasoning && this.wireReasoning() && /reasoning[_ ]effort/i.test(text)) {
      this.dropReasoning = true;
      process.stderr.write(
        'warning: endpoint rejected reasoning_effort; retrying without it (reasoning stays on)\n',
      );
      return true;
    }
    if (!this.dropMaxTokens && this.maxTokens && /\bmax_tokens\b/i.test(text)) {
      this.dropMaxTokens = true;
      process.stderr.write(
        'warning: endpoint rejected max_tokens; retrying without it (the provider default applies)\n',
      );
      return true;
    }
    // The wording a provider uses is "Unrecognized request argument supplied:
    // temperature" or "`temperature` is not supported"; both name the field, so
    // matching the name is what matters. Sampling then falls back to the
    // endpoint's own default, which is the pre-existing behaviour: the TM lookup
    // before the queue still keeps the same block from being answered twice.
    if (!this.dropTemperature && /\btemperature\b/i.test(text)) {
      this.dropTemperature = true;
      process.stderr.write(
        'warning: endpoint rejected temperature; retrying without it ' +
          '(the provider default sampling applies, so wordings may drift)\n',
      );
      return true;
    }
    return false;
  }

  async chat(user, {retries = this.config.maxRetries, system} = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(this.config.baseUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(this.requestBody(user, system)),
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
        // A provider that does not implement `reasoning_effort` (or
        // `max_tokens`) names it in the 400 body. Dropping just that field and
        // asking again costs one request, not one retry, and degrades a new
        // endpoint to the request this tool sent before the fields existed.
        // Bounded: each flag is set at most once, so this cannot loop.
        if (this.dropRejectedParameter(failure)) {
          attempt--;
          continue;
        }
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
    // `reasoning`, `max_tokens` and `temperature` are part of the run's identity:
    // two batches with the same model but a different sampling or thinking policy
    // have very different costs and wordings, and this log is what a cost review
    // reads when it asks why the same paragraph was translated twice.
    const policy = {
      reasoning: this.dropReasoning ? `${this.reasoning} (rejected; omitted)` : this.reasoning,
      max_tokens: this.dropMaxTokens ? null : this.maxTokens,
      temperature: this.dropTemperature ? null : this.temperature,
    };
    fs.appendFileSync(
      file,
      `${JSON.stringify({at: new Date().toISOString(), provider: this.config.provider, model: this.config.model, ...policy, ...this.usage})}\n`,
    );
  }
}

export const USAGE_FILE = path.join(WORK_DIR, 'usage.jsonl');
