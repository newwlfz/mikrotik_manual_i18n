#!/usr/bin/env node
/**
 * One canonical spelling for the "Back To Home" feature.
 *
 * Two defects are repaired here, both of them wording the translation memory
 * carried from an older capture:
 *
 *   1. `返回首页` / `返回主页` ("back to home" read as a navigation link) is the
 *      wrong rendering of the product name. The memory entries that hold it are
 *      removed, so `apply` / `derive` cannot write it back, and every overlay is
 *      rewritten to the product name.
 *   2. The glossary used to map `Back To Home` to `Back To Home（远程回家）`, so
 *      every mention carried the parenthesis. Only the first mention of a page
 *      keeps the explanation now (see `lib/term-annotate.mjs`).
 *
 * The pass is idempotent: existing annotations are stripped before the first
 * occurrence is annotated again, so running it twice changes nothing. It runs at
 * the end of the translate chain (`translate:apply`, `translate:derive`), after
 * every producer has written its overlays.
 *
 *   node tools/translate/fix-back-to-home.mjs            # apply
 *   node tools/translate/fix-back-to-home.mjs --check    # report, exit 1 if work remains
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {SECTIONS, WORK_DIR, tmFile, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter, renderDocument} from './lib/frontmatter.mjs';
import {annotateDocumentTerms} from './lib/term-annotate.mjs';

/** The product name and the two wrong renderings an older capture used. */
export const PRODUCT_NAME = 'Back To Home';
const WRONG = /\u8fd4\u56de\u9996\u9875|\u8fd4\u56de\u4e3b\u9875/g;

/** The default locale's TM file keeps the conventional name (`tm-global.<locale>`). */
const TM_NAME = path.basename(tmFile());
const MEMORY_FILES = ['model-memory.json', TM_NAME];

const hasWrong = (value) => typeof value === 'string' && WRONG.test(value);

/**
 * Delete every memory entry whose value carries a wrong rendering.
 *
 * Deleting (rather than rewriting) is deliberate: a block translated with
 * `返回首页` also has a wrong link label, and the English source is the only
 * trustworthy input for it. The block then stays English for one run and comes
 * back through the normal translation channel.
 */
export function cleanMemory({write = true} = {}) {
  const removed = {};
  for (const name of MEMORY_FILES) {
    const file = path.join(WORK_DIR, name);
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    let count = 0;
    if (name === TM_NAME) {
      for (const [key, entry] of Object.entries(raw.entries || {})) {
        if (entry && hasWrong(entry.text)) {
          delete raw.entries[key];
          count++;
        }
      }
    } else {
      for (const [key, value] of Object.entries(raw)) {
        if (hasWrong(value)) {
          delete raw[key];
          count++;
        }
      }
    }
    WRONG.lastIndex = 0;
    removed[name] = count;
    if (write && count) fs.writeFileSync(file, JSON.stringify(raw));
  }
  return removed;
}

/** Replace the wrong renderings with the product name. */
export function fixBody(text) {
  WRONG.lastIndex = 0;
  return String(text).replace(WRONG, PRODUCT_NAME);
}

const countWrong = (text) => (String(text).match(WRONG) || []).length;

export function main() {
  const CHECK = process.argv.includes('--check');
  const memoryRemoved = cleanMemory({write: !CHECK});
  const stats = {files: 0, changed: 0, wrongTerms: 0, memoryRemoved};
  const samples = [];

  for (const section of SECTIONS) {
    const overlayBase = path.join(section.overlay);
    for (const file of walkMarkdown(overlayBase)) {
      stats.files++;
      const text = fs.readFileSync(file, 'utf8');
      const {frontMatter, body} = splitFrontMatter(text);
      stats.wrongTerms += countWrong(frontMatter) + countWrong(body);
      const fixed = annotateDocumentTerms(fixBody(frontMatter), fixBody(body));
      if (fixed.frontMatter === frontMatter && fixed.body === body) continue;
      stats.changed++;
      if (samples.length < 5) samples.push(relative(overlayBase, file));
      if (CHECK) continue;
      const hasFrontMatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(text);
      fs.writeFileSync(
        file,
        hasFrontMatter
          ? renderDocument(fixed.frontMatter, fixed.body.trim())
          : `${fixed.body.trim()}\n`,
      );
    }
  }

  console.log(JSON.stringify({mode: CHECK ? 'check' : 'apply', ...stats, samples}, null, 1));
  if (CHECK && (stats.changed || Object.values(memoryRemoved).some(Boolean))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
