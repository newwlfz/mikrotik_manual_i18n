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
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO, WORK_DIR, ensureDir} from './paths.mjs';
import {segmentation} from './segments.mjs';
import {
  LLMRequestError,
  errorFromNetwork,
  errorFromResponse,
  loadLLMConfig,
} from './llm-config.mjs';

export function loadConfig() {
  const raw = fs.readFileSync(path.join(REPO, 'config/translation.yml'), 'utf8');
  const config = YAML.parse(raw) || {};
  const llm = loadLLMConfig();
  for (const warning of llm.warnings) process.stderr.write(`warning: ${warning}\n`);

  const glossaryFile = path.join(REPO, config.glossary || 'config/glossary/zh-Hans.yml');
  const glossary = fs.existsSync(glossaryFile)
    ? (YAML.parse(fs.readFileSync(glossaryFile, 'utf8'))?.terms || [])
    : [];

  return {
    // Provenance label written to `translation_provider`; the wire protocol is
    // always OpenAI chat-completions, so it is not used to select a client.
    provider: config.provider || 'openai-compatible',
    model: llm.model,
    baseUrl: llm.endpoint,
    apiKey: llm.apiKey,
    // Segmentation is policy, not a flag: one request carries at most
    // `max_blocks` blocks and `max_chars` characters (config/translation.yml).
    batchSize: segmentation().maxBlocks,
    maxChars: segmentation().maxChars,
    maxRetries: llm.maxRetries,
    timeoutMs: llm.timeoutMs,
    extraHeaders: llm.extraHeaders,
    temperature: config.temperature ?? 0,
    glossary,
  };
}

const SYSTEM = `You translate MikroTik RouterOS documentation from English to Simplified Chinese.

Return ONLY the translated Markdown: no preface, no explanation, no code fence around the answer.

Rules, in order of importance:
1. Preserve block structure exactly: the same headings, the same list markers, the same table rows,
   the same paragraph boundaries, the same number of blank-line separated blocks.
2. Reproduce every HTML/MDX tag and attribute character for character.
3. Translate prose only: headings, paragraphs, list items, table cells, image alt text.
4. Never translate identifiers: CLI commands, menu paths, parameter and property names, enum
   values, flags, protocol and product names, RouterOS and MikroTik, anything in backticks,
   and anything written in kebab-case, snake_case or camelCase.
5. Fenced code blocks are copied verbatim, including the fence lines.
6. Quotes inside prose stay balanced; never introduce a line that starts with the bare words
   import or export outside a fence.
7. Keep the same number of blocks. If the input has N blocks, the output has N blocks.`;

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

  system() {
    const terms = this.config.glossary
      .map((term) => `- ${term.source} → ${term.target}`)
      .join('\n');
    return terms ? `${SYSTEM}\n\nGlossary (keep these exactly):\n${terms}` : SYSTEM;
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
              {role: 'system', content: system || this.system()},
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
