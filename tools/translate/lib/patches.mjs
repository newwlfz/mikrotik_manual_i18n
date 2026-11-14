/**
 * Page-level translation patches.
 *
 * Some rules cannot be generalised: an official page may use a term that the
 * glossary gets wrong, or a block that must stay English. Those exceptions are
 * data files, not hand edits to the overlay, so `apply` and `translate` keep
 * reproducing them on every run.
 *
 *   config/translation-patches/<locale>/<section>/<path>.yml
 *
 *   title: "覆盖后的标题"
 *   keep_english:
 *     - "Exact English block that must not be translated"
 *   replace:
 *     - from: "旧的译法"
 *       to: "新的译法"
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {patchDir} from './paths.mjs';
import {normalize} from './blocks.mjs';

export function loadPatch(locale, section, rel) {
  const file = path.join(patchDir(locale), section, `${rel}.yml`);
  if (!fs.existsSync(file)) return null;
  const data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return {
    file,
    title: data.title || null,
    keepEnglish: new Set((data.keep_english || []).map((block) => normalize(block))),
    replace: data.replace || [],
  };
}

export function applyReplacements(body, patch) {
  if (!patch || !patch.replace.length) return body;
  let out = body;
  for (const rule of patch.replace) {
    if (rule && typeof rule.from === 'string' && typeof rule.to === 'string') {
      out = out.split(rule.from).join(rule.to);
    }
  }
  return out;
}
