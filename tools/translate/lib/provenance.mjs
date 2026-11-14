/**
 * Front-matter provenance for translated overlays.
 *
 * `translated_at` records when this overlay was written; the provider and
 * model come from `config/translation.yml`. The config is read directly instead
 * of through `lib/provider.mjs#loadConfig`, because `apply` and `derive` are
 * offline stages and must work without an API key.
 *
 * `withFields` appends these keys to an overlay's front matter; the English
 * sources never receive them, and existing keys keep their order and value.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {REPO} from './paths.mjs';

// One timestamp per process: every overlay written by a run shares the same
// `translated_at`, which keeps the diff deterministic and readable.
const TRANSLATED_AT = new Date().toISOString();

let cached = null;

function configValue() {
  if (cached) return cached;
  let provider = null;
  let model = null;
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
  cached = {provider, model};
  return cached;
}

/** The three provenance keys written into every translated overlay. */
export function translationProvenance() {
  const {provider, model} = configValue();
  return {
    translated_at: TRANSLATED_AT,
    translation_provider: provider,
    translation_model: model,
  };
}
