/**
 * OpenAI-compatible chat client for the translation batches.
 *
 * Only the units the overlay still has in English are ever sent, which keeps a
 * run small and resumable. Credentials come from the environment or a local
 * `.env`; they are never written to the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import {REPO, WORKSPACE, WORK_DIR, ensureDir} from './paths.mjs';
import {segmentation} from './segments.mjs';

function readEnv() {
  const out = {};
  for (const file of [path.join(REPO, '.env'), path.join(WORKSPACE, '.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      out[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

export function loadConfig() {
  const raw = fs.readFileSync(path.join(REPO, 'config/translation.yml'), 'utf8');
  const config = YAML.parse(raw) || {};
  const env = readEnv();
  const keyName = config.api_key_env || 'DEEPSEEK_API_KEY';
  const apiKey = process.env[keyName] || env[keyName];
  if (!apiKey) throw new Error(`${keyName} is not set (environment or .env)`);
  const baseUrl = config.base_url || 'https://api.deepseek.com/v1/chat/completions';
  const glossaryFile = path.join(REPO, config.glossary || 'config/glossary/zh-Hans.yml');
  const glossary = fs.existsSync(glossaryFile)
    ? (YAML.parse(fs.readFileSync(glossaryFile, 'utf8'))?.terms || [])
    : [];
  return {
    provider: config.provider || 'deepseek',
    model: config.model || 'deepseek-chat',
    baseUrl,
    apiKey,
    // Segmentation is policy, not a flag: one request carries at most
    // `max_blocks` blocks and `max_chars` characters (config/translation.yml).
    batchSize: segmentation().maxBlocks,
    maxChars: segmentation().maxChars,
    maxRetries: config.max_retries ?? 2,
    temperature: config.temperature ?? 0,
    sessionHeader: config.session_header || null,
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
    };
    if (config.sessionHeader) {
      this.headers[config.sessionHeader] = crypto.randomUUID();
    }
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
        });
        if (response.status === 401 || response.status === 402) {
          throw new Error(`fatal provider status ${response.status}: ${(await response.text()).slice(0, 200)}`);
        }
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        const data = await response.json();
        const choice = data.choices?.[0];
        if (!choice?.message?.content) throw new Error('response without content');
        this.usage.prompt += data.usage?.prompt_tokens || 0;
        this.usage.completion += data.usage?.completion_tokens || 0;
        this.usage.calls++;
        if (choice.finish_reason === 'length') throw new Error('response truncated at the output limit');
        return choice.message.content.trim();
      } catch (error) {
        lastError = error;
        if (/fatal provider status/.test(error.message)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
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
