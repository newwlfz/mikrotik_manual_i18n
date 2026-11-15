#!/usr/bin/env node
/**
 * Harvest the existing Chinese overlays into the block memory.
 *
 * The legacy corpus that produced most of the overlays has been removed, so a
 * rebuild can no longer look those sentences up and would replace reviewed
 * Chinese with English. The overlays themselves are the corpus now: this stage
 * pairs each English source block with the Chinese block the published overlay
 * put opposite it and writes the pair into `work/translate/model-memory.json`,
 * the persistent store `tm-global` is rebuilt from on every `apply`.
 *
 * Alignment is deliberately conservative, and reuses the same machinery as
 * `apply` (`splitBlockSpans` / `splitBlocks` / `sameBlockShape`):
 *
 *   - a page is harvested only when the two block lists have the same shape:
 *     block count, fence count, admonition count, image count and table-row
 *     count must all match, and every block must have the same signature
 *     (heading level, list marker, table, code, component, ...);
 *   - a page that fails either gate is skipped whole and counted
 *     (`skippedShape`), never paired by position anyway;
 *   - only pairs whose English block carries an ASCII word and whose Chinese
 *     block carries CJK are stored, and code / pictures / horizontal rules /
 *     component-only blocks are never stored;
 *   - an existing key is never overwritten: a different value is counted as a
 *     `conflict`, so the reviewed model wording keeps priority.
 *
 * Usage:
 *   node tools/translate/harvest.mjs [--dry-run] [--section=NAME] [--locale=NAME]
 *
 * `--locale` defaults to `zh-Hans`; a locale that is not enabled in
 * `docusaurus.config.ts` is accepted in `--dry-run` only (it finds no overlays).
 * Dry-run reports what would be written (including the simulated hardware
 * pendingBlocks) without touching the memory file.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  assertTranslationLocale,
  sectionsFor,
  REPO,
  WORK_DIR,
  walkMarkdown,
  relative,
} from './lib/paths.mjs';
import {
  splitBlockSpans,
  splitBlocks,
  sameBlockShape,
  normalize,
  hasFence,
  isImageBlock,
  isStructuralBlock,
  isTagOnlyBlock,
  isHorizontalRule,
} from './lib/blocks.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';
import {parseAdmonitionOpener} from './lib/admonitions.mjs';
import {loadModelMemory, saveModelMemory, MODEL_MEMORY} from './lib/model-memory.mjs';
import {buildGlobalTm} from './lib/tm.mjs';
import {applySection} from './lib/apply.mjs';

const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const ENGLISH_WORD = /[A-Za-z]{3,}/;
// Some English pages carry official legal paragraphs in Russian (the warranty
// notices on the hardware pages). They are prose and their overlays are Chinese,
// so "an ASCII word" alone would drop them and a rebuild would put the Russian
// back. A non-Latin word only counts when the block is running text (two or more
// words), so a bare identifier or part number is still never harvested.
const ANY_WORD = /[\p{L}]{3,}/u;
const CJK = /[\u4e00-\u9fff]/;

/**
 * Structural fingerprint of a block list. `sameBlockShape` compares blocks one
 * by one; this adds the counts it cannot see (a table with three rows and one
 * with five both sign as `T`, and an admonition is signed as prose).
 */
function shape(blocks) {
  const out = {blocks: blocks.length, fences: 0, admonitions: 0, images: 0, tableRows: 0};
  for (const block of blocks) {
    if (hasFence(block)) out.fences++;
    out.images += (block.match(IMAGE) || []).length;
    out.tableRows += (block.match(/^\s*\|/gm) || []).length;
    for (const line of block.split('\n')) if (parseAdmonitionOpener(line)) out.admonitions++;
  }
  return out;
}

/** Is this English block a translation unit, and does the Chinese block carry it? */
function harvestable(span, chinese) {
  const english = span.text;
  if (span.code) return false;
  if (isHorizontalRule(english) || isImageBlock(english)) return false;
  if (isStructuralBlock(english) || isTagOnlyBlock(english)) return false;
  if (hasFence(english)) return false;
  if (!ENGLISH_WORD.test(english) && !(ANY_WORD.test(english) && /\s/.test(english.trim()))) {
    return false;
  }
  if (!CJK.test(chinese)) return false;
  // A two-character key would collide with too much prose; `apply` ignores
  // those keys in the same way.
  if (normalize(english).length < 2) return false;
  return true;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

let coverageBase = null;
/** Pending English blocks of a section under a given model memory. */
function pendingBlocksFor(sectionName, model, locale) {
  if (!coverageBase) {
    coverageBase = {
      legacy: loadJson(path.join(WORK_DIR, 'translation-memory.json'), {}),
      comment: loadJson(path.join(WORK_DIR, 'comment-memory.json'), {entries: {}}),
    };
  }
  const tm = buildGlobalTm({...coverageBase, model});
  const section = sectionsFor(locale).find((item) => item.name === sectionName);
  if (!section) return null;
  const state = applySection(section, new Map(), {}, {
    write: false,
    tm,
    modelMemory: new Map(),
    commentMemory: new Map(),
    adopt: true,
    titleIndex: null,
    // A coverage probe must not print the per-page `preserved:` lines that a
    // dry-run apply reports; the guard itself still runs, so the count of
    // pending blocks reflects the pages a real apply would keep.
    log: false,
  });
  return state.pendingBlocks;
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const only = argv.find((arg) => arg.startsWith('--section='))?.slice('--section='.length) || null;
  const requested = argv.find((arg) => arg.startsWith('--locale='))?.slice('--locale='.length);
  const locale = assertTranslationLocale(requested || DEFAULT_TARGET_LOCALE, {readOnly: dryRun});

  const memory = loadModelMemory();
  const before = Object.fromEntries(memory);
  const perSection = {};
  const totals = {files: 0, blocks: 0, paired: 0, added: 0, skippedShape: 0, conflicts: 0, existing: 0, noOverlay: 0};

  for (const section of sectionsFor(locale)) {
    if (only && section.name !== only) continue;
    if (section.derivedFrom) {
      // `apply` never rebuilds a derived section; its overlay is a copy of the
      // canonical one and harvesting it would only duplicate the same blocks
      // under a second section key.
      perSection[section.name] = {derived: true};
      continue;
    }
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const stat = {files: 0, blocks: 0, paired: 0, added: 0, skippedShape: 0, conflicts: 0, existing: 0, noOverlay: 0};
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) {
        stat.noOverlay++;
        continue;
      }
      const englishBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
      const chineseBody = splitFrontMatter(fs.readFileSync(overlayPath, 'utf8')).body;
      const spans = splitBlockSpans(englishBody);
      const english = spans.map((span) => span.text);
      const chinese = splitBlocks(chineseBody);
      stat.files++;
      stat.blocks += english.length;

      if (english.length === 0 || chinese.length === 0) {
        stat.skippedShape++;
        continue;
      }
      // Two gates: the aggregate fingerprint (fence/admonition/image/table-row
      // counts) and the per-block signature. A page that fails either is not
      // paired by position at all.
      if (
        JSON.stringify(shape(english)) !== JSON.stringify(shape(chinese)) ||
        !sameBlockShape(english, chinese)
      ) {
        stat.skippedShape++;
        continue;
      }

      for (let i = 0; i < english.length; i++) {
        const span = spans[i];
        const translated = chinese[i];
        if (!harvestable(span, translated)) continue;
        stat.paired++;
        // Exactly the key `apply` looks up (`section + NUL + normalize(block)`)
        // and `buildGlobalTm` reads back; `normalize` is the same function both
        // sides use, so no separate key dialect is introduced.
        const key = `${section.name}\u0000${normalize(span.text)}`;
        if (memory.has(key)) {
          if (memory.get(key) === translated) stat.existing++;
          else stat.conflicts++;
          continue;
        }
        memory.set(key, translated);
        stat.added++;
      }
    }
    perSection[section.name] = stat;
    for (const name of Object.keys(totals)) totals[name] += stat[name] || 0;
  }

  const after = Object.fromEntries(memory);
  const pendingBefore = pendingBlocksFor('hardware', before, locale);
  const pendingAfter = pendingBlocksFor('hardware', after, locale);

  for (const [name, stat] of Object.entries(perSection)) {
    if (stat.derived) {
      process.stdout.write(`harvest ${name}: skipped (derived)\n`);
      continue;
    }
    process.stdout.write(
      `harvest ${name}: files=${stat.files} blocks=${stat.blocks} paired=${stat.paired} ` +
        `added=${stat.added} skippedShape=${stat.skippedShape} conflicts=${stat.conflicts} ` +
        `existing=${stat.existing} noOverlay=${stat.noOverlay}\n`,
    );
  }
  process.stdout.write(
    `harvest: files=${totals.files} blocks=${totals.blocks} paired=${totals.paired} ` +
      `added=${totals.added} skippedShape=${totals.skippedShape} conflicts=${totals.conflicts}\n`,
  );
  process.stdout.write(
    `harvest coverage: hardware pendingBlocks before=${pendingBefore} after=${pendingAfter}\n`,
  );
  if (pendingBefore !== null && pendingAfter !== null && pendingAfter > pendingBefore) {
    // Harvest only adds memory, so coverage can never regress. If it does, the
    // pairing or the key format is wrong: fail loudly instead of writing.
    process.stderr.write(
      `harvest: hardware pendingBlocks grew (${pendingBefore} -> ${pendingAfter}); refusing to write\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    process.stdout.write('harvest: dry-run — model-memory.json not written\n');
    return;
  }
  if (totals.added === 0) {
    process.stdout.write('harvest: nothing new — model-memory.json not rewritten\n');
    return;
  }
  // Keep a backup next to the file before rewriting it: the memory is the only
  // durable record of model + harvested wording.
  if (fs.existsSync(MODEL_MEMORY)) {
    const backup = `${MODEL_MEMORY}.bak-${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(MODEL_MEMORY, backup);
    process.stdout.write(`harvest: backup ${backup}\n`);
  }
  saveModelMemory(memory);
  process.stdout.write(`harvest: wrote ${MODEL_MEMORY} (+${totals.added} keys)\n`);
}

try {
  main();
} catch (error) {
  // A bad `--locale=` is a user error: one line, no stack trace.
  if (!(error instanceof LocaleError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
