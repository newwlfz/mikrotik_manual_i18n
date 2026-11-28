/**
 * Request segmentation for the translation batches.
 *
 * A page is translated one request at a time, and an oversized request is what
 * used to force a manual split: the endpoint answers "fetch failed" and the
 * operator cut the page by hand. Both limits are policy, so they live in
 * `config/translation.yml` instead of in a command-line flag:
 *
 *   segmentation:
 *     max_blocks: 8      # how many blocks one request carries
 *     max_chars: 8000    # how many characters one request may carry
 *
 * The values are the ones the command line used to hard-code, so moving them
 * into the config changes no behaviour until someone edits the file.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import {REPO} from './paths.mjs';

export const SEGMENTATION_DEFAULTS = {maxBlocks: 8, maxChars: 8000};

let cache = null;

/** `{maxBlocks, maxChars}` for the current configuration. */
export function segmentation() {
  if (cache) return cache;
  const values = {...SEGMENTATION_DEFAULTS};
  const file = path.join(REPO, 'config/translation.yml');
  if (fs.existsSync(file)) {
    const config = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
    const section = config.segmentation || {};
    const blocks = Number(section.max_blocks);
    const chars = Number(section.max_chars);
    if (Number.isFinite(blocks) && blocks > 0) values.maxBlocks = Math.floor(blocks);
    if (Number.isFinite(chars) && chars > 0) values.maxChars = Math.floor(chars);
    // `batch_size` predates the segmentation block; honour it when the new key
    // is absent so an older config file keeps working.
    const legacy = Number(config.batch_size);
    if (!Number.isFinite(blocks) && Number.isFinite(legacy) && legacy > 0) {
      values.maxBlocks = Math.floor(legacy);
    }
  }
  cache = values;
  return cache;
}

/**
 * Split items into requests of at most `maxBlocks` items / `maxChars` chars.
 *
 * `sizeOf` reads an item's length; a single item larger than the budget still
 * gets its own request (splitting a block would change the block count the
 * caller matches against).
 */
export function segmentByBudget(items, {maxBlocks, maxChars, sizeOf = (item) => String(item).length} = {}) {
  const limits = {...segmentation(), ...(maxBlocks ? {maxBlocks} : {}), ...(maxChars ? {maxChars} : {})};
  const out = [];
  let current = [];
  let chars = 0;
  for (const item of items) {
    const size = sizeOf(item);
    if (current.length >= limits.maxBlocks || (current.length > 0 && chars + size > limits.maxChars)) {
      out.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += size;
  }
  if (current.length) out.push(current);
  return out;
}
