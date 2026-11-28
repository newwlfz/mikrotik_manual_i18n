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
 *   - a pair whose Chinese (or English) text glues a Han run into an ASCII
 *     command / parameter / path token is rejected — the same `hasGluedToken`
 *     detector `tm-backfill` uses before writing a candidate;
 *   - an existing key is never overwritten: a different value is counted as a
 *     `conflict`, so the reviewed model wording keeps priority.
 *
 * Front matter (`title`, `sidebar_label`, `description`) is harvested too. The
 * keys are the exact short-text keys `apply` reads — `title:<English>` and
 * `description:<English>` — which `buildGlobalTm` maps into the shared `title`
 * kind (`title\0<English>`) that `lookupTitle` serves. `apply` looks up the
 * title at lib/apply.mjs:1044-1045 and the description at lib/apply.mjs:1104;
 * the sidebar label is derived from that same translated title through
 * `sidebarLabelZh`, and storing it under `title:<English label>` also makes
 * `lookupTitle(tm, label)` hit. Only fields whose ENGLISH source value has no
 * CJK and whose OVERLAY value does are taken.
 *
 * Usage:
 *   node tools/translate/harvest.mjs [--dry-run] [--section=NAME] [--locale=NAME]
 *                                   [--no-frontmatter] [--clean-glued]
 *                                   [--clean-product-names]
 *                                   [--force-overwrite-conflicts]
 *
 * `--locale` defaults to `zh-Hans`; a locale that is not enabled in
 * `docusaurus.config.ts` is accepted in `--dry-run` only (it finds no overlays).
 * `--no-frontmatter` disables the front-matter pass; it is on by default.
 * `--force-overwrite-conflicts` is opt-in and ONLY touches front-matter keys:
 * when a stored `title:`/`description:` value has no Han character and the
 * overlay supplies a CJK one, the reviewed Chinese value replaces the English
 * placeholder. Block conflicts (7,000+) are never overwritten.
 * `--clean-glued` is a separate maintenance mode: it removes every glued entry
 * from the merged memory, rewrites `model-memory.json` and appends a correction
 * shard with tombstones. Normal harvest never deletes anything — cleaning is
 * explicit so a bad-glued value cannot be silently dropped from an unrelated run.
 * Dry-run reports what would be written without touching the memory file.
 *
 * `--clean-product-names` is the one-time counterpart for model names: a
 * remembered `title:Audience -> 受众` (or a heading that turned `hAP be³ Media`
 * into `hAP be³ 媒体`) is a bad memory entry, not a reviewed translation. The
 * guard below stops harvest from re-importing such a pair; this mode tombstones
 * the keys that are already polluted. The memory itself is kept, per the
 * "TM 保留" decision — only the wrong keys are suppressed by later shards.
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
import {splitFrontMatter, readField} from './lib/frontmatter.mjs';
import {parseAdmonitionOpener} from './lib/admonitions.mjs';
import {
  loadModelMemory,
  saveModelMemory,
  writeMemoryShard,
  MODEL_MEMORY,
} from './lib/model-memory.mjs';
import {buildGlobalTm, hasGluedToken, productHeadingGuard} from './lib/tm.mjs';
import {canonicalProductName} from './lib/keep-english.mjs';
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
 * Front-matter fields harvested as short-text entries. The second element is
 * the memory-key prefix: both `title:` and `description:` are recognised by
 * `buildGlobalTm` (lib/tm.mjs:270-277 / :307-314) and folded into `titleKey()`,
 * i.e. the same `title\0<English>` index `lookupTitle` reads. The sidebar label
 * deliberately shares the `title:` prefix: `apply` has no dedicated label TM
 * read, but it derives the label from the translated title (lib/apply.mjs:1053
 * -1063) and `lookupTitle(tm, label)` can also find the stored value.
 */
const FRONT_MATTER_FIELDS = [
  ['title', 'title', 'title'],
  ['sidebar_label', 'title', 'label'],
  ['description', 'description', 'description'],
];

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
  // A glued token (`/使用者/settings`, `link-日誌in`) is a broken command or
  // path, not a translation. `tm-backfill` rejects such candidates at write
  // time (tm-backfill.mjs:498/758); harvest must not re-import them into the
  // model memory in the first place.
  if (hasGluedToken(chinese) || hasGluedToken(english)) return false;
  // A two-character key would collide with too much prose; `apply` ignores
  // those keys in the same way.
  if (normalize(english).length < 2) return false;
  return true;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Harvest one page's translatable front matter. No shape gate applies: front
 * matter is independent of the body blocks. Only an English source value with
 * a CJK overlay value is a translation unit worth remembering.
 */
function harvestFrontMatter(sourcePath, overlayPath, memory, stat, forceOverwrite, locale) {
  const sourceFm = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).frontMatter;
  const overlayFm = splitFrontMatter(fs.readFileSync(overlayPath, 'utf8')).frontMatter;
  for (const [field, prefix, name] of FRONT_MATTER_FIELDS) {
    const english = readField(sourceFm, field);
    const chinese = readField(overlayFm, field);
    if (!english || !chinese) continue;
    if (CJK.test(english) || !CJK.test(chinese)) continue;
    // Model / proper-noun guard: a configured product name is data, so a CJK
    // overlay value ("受众" for "Audience") is by definition a mistranslation.
    // Never write it into the memory, even under --force-overwrite-conflicts.
    if (canonicalProductName(english, locale)) {
      stat.fmProductSkipped = (stat.fmProductSkipped || 0) + 1;
      continue;
    }
    if (hasGluedToken(english) || hasGluedToken(chinese)) {
      stat.fmGluedRejected++;
      continue;
    }
    const key = `${prefix}:${english}`;
    stat.fmPaired++;
    if (memory.has(key)) {
      const stored = memory.get(key);
      if (stored === chinese) stat.fmExisting++;
      else if (forceOverwrite && !CJK.test(String(stored ?? ''))) {
        // An English-ish placeholder (a model answer that kept the proper noun,
        // or a null tombstone) must not mask a reviewed Chinese front-matter
        // value. Opt-in only, and limited to these short-text keys.
        memory.set(key, chinese);
        stat.fmForced++;
        stat[`fmAdded_${name}`] = (stat[`fmAdded_${name}`] || 0) + 1;
      } else stat.fmConflicts++;
      continue;
    }
    memory.set(key, chinese);
    stat.fmAdded++;
    stat[`fmAdded_${name}`] = (stat[`fmAdded_${name}`] || 0) + 1;
  }
}

/** Front-matter pass over one section (including a derived one). */
function harvestSectionFrontMatter(section, memory, stat, forceOverwrite, locale) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  for (const sourcePath of walkMarkdown(sourceBase)) {
    const rel = relative(sourceBase, sourcePath);
    const overlayPath = path.join(overlayBase, rel);
    if (fs.existsSync(overlayPath)) {
      harvestFrontMatter(sourcePath, overlayPath, memory, stat, forceOverwrite, locale);
    }
  }
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

/**
 * Explicit maintenance mode: delete glued entries from the merged memory.
 *
 * `model-memory.json` is rewritten without the offending keys and one
 * correction shard is appended with `null` tombstones. Every shard replays in
 * filename order over the baseline (lib/model-memory.mjs:58-74), so the
 * tombstone wins over an older copy of the same bad value; `buildGlobalTm`
 * drops null/empty values (`cleanText`, lib/tm.mjs:68-71), so the entry no
 * longer reaches the global TM. Re-running with no glued entries is a no-op.
 */
function cleanGlued({dryRun, locale}) {
  const memory = loadModelMemory();
  const bad = [...memory].filter(([, value]) => hasGluedToken(value));
  process.stdout.write(
    `clean-glued: ${memory.size} merged entries, ${bad.length} glued entries\n`,
  );
  for (const [key, value] of bad.slice(0, 5)) {
    process.stdout.write(`clean-glued: ${JSON.stringify(key)} = ${JSON.stringify(value)}\n`);
  }
  if (dryRun) {
    process.stdout.write('clean-glued: dry-run — nothing written\n');
    return;
  }
  if (bad.length === 0) {
    process.stdout.write('clean-glued: already clean — nothing written\n');
    return;
  }
  if (fs.existsSync(MODEL_MEMORY)) {
    const backup = `${MODEL_MEMORY}.bak-glued-${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(MODEL_MEMORY, backup);
    process.stdout.write(`clean-glued: backup ${backup}\n`);
  }
  const clean = new Map(memory);
  for (const [key] of bad) clean.delete(key);
  saveModelMemory(clean, {locale, shard: false});
  const shard = writeMemoryShard(
    new Map(bad.map(([key]) => [key, null])),
    {locale},
  );
  process.stdout.write(
    `clean-glued: rewrote ${MODEL_MEMORY} (-${bad.length} keys), ` +
      `tombstones ${path.relative(WORK_DIR, shard.file)} (${shard.entries} keys)\n`,
  );
}

/**
 * One-time maintenance mode: tombstone memory keys that translate a model name.
 *
 * Two shapes are recognised: short-text keys (`title:Audience -> 受众`) whose
 * English value is a configured product, and heading blocks whose remembered
 * Chinese dropped a configured model (`# hAP be³ Media -> # hAP be³ 媒体`).
 * A null in a later shard makes `buildGlobalTm` drop the key entirely, so the
 * reviewed rest of the memory is untouched ("TM 保留"). Re-running is a no-op.
 */
function cleanProductNames({dryRun, locale}) {
  const memory = loadModelMemory();
  const polluted = [];
  for (const [key, value] of memory) {
    const text = String(value ?? '');
    if (!text || !CJK.test(text)) continue;
    let english = null;
    let reason = null;
    for (const prefix of ['title:', 'description:']) {
      if (key.startsWith(prefix)) {
        english = key.slice(prefix.length);
        break;
      }
    }
    if (!english) {
      const separator = key.indexOf('\u0000');
      if (separator !== -1) english = key.slice(separator + 1);
    }
    if (!english) continue;
    if (!reason && canonicalProductName(english, locale)) reason = 'model-title';
    if (!reason && productHeadingGuard(english, text, locale) !== text) reason = 'model-heading';
    if (reason) polluted.push([key, text, reason]);
  }
  process.stdout.write(
    `clean-product-names: ${memory.size} merged entries, ${polluted.length} polluted key(s)\n`,
  );
  for (const [key, text, reason] of polluted.slice(0, 10)) {
    process.stdout.write(
      `clean-product-names: [${reason}] ${JSON.stringify(key)} -> ${JSON.stringify(text.slice(0, 80))}\n`,
    );
  }
  if (dryRun) {
    process.stdout.write('clean-product-names: dry-run — nothing written\n');
    return;
  }
  if (polluted.length === 0) {
    process.stdout.write('clean-product-names: already clean — nothing written\n');
    return;
  }
  if (fs.existsSync(MODEL_MEMORY)) {
    const backup = `${MODEL_MEMORY}.bak-product-names-${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(MODEL_MEMORY, backup);
    process.stdout.write(`clean-product-names: backup ${backup}\n`);
  }
  const clean = new Map(memory);
  for (const [key] of polluted) clean.delete(key);
  saveModelMemory(clean, {locale, shard: false});
  const shard = writeMemoryShard(
    new Map(polluted.map(([key]) => [key, null])),
    {locale},
  );
  process.stdout.write(
    `clean-product-names: rewrote ${MODEL_MEMORY} (-${polluted.length} keys), ` +
      `tombstones ${path.relative(WORK_DIR, shard.file)} (${shard.entries} keys)\n`,
  );
}

function newStat() {
  return {
    files: 0,
    blocks: 0,
    paired: 0,
    added: 0,
    skippedShape: 0,
    conflicts: 0,
    existing: 0,
    noOverlay: 0,
    gluedRejected: 0,
    fmPaired: 0,
    fmAdded: 0,
    fmExisting: 0,
    fmConflicts: 0,
    fmForced: 0,
    fmGluedRejected: 0,
    fmProductSkipped: 0,
    fmAdded_title: 0,
    fmAdded_label: 0,
    fmAdded_description: 0,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const cleanGluedMode = argv.includes('--clean-glued');
  const cleanProductNamesMode = argv.includes('--clean-product-names');
  const noFrontMatter = argv.includes('--no-frontmatter');
  const forceOverwrite = argv.includes('--force-overwrite-conflicts');
  const only = argv.find((arg) => arg.startsWith('--section='))?.slice('--section='.length) || null;
  const requested = argv.find((arg) => arg.startsWith('--locale='))?.slice('--locale='.length);
  const locale = assertTranslationLocale(requested || DEFAULT_TARGET_LOCALE, {readOnly: dryRun});

  if (cleanGluedMode) {
    cleanGlued({dryRun, locale});
    return;
  }
  if (cleanProductNamesMode) {
    cleanProductNames({dryRun, locale});
    return;
  }

  const memory = loadModelMemory();
  const before = Object.fromEntries(memory);
  const perSection = {};
  const totals = newStat();

  for (const section of sectionsFor(locale)) {
    if (only && section.name !== only) continue;
    if (section.derivedFrom) {
      // `apply` never rebuilds a derived section; its overlay is a copy of the
      // canonical one and harvesting its BLOCKS would only duplicate the same
      // text under a second section key. Front matter is different: its keys
      // are section-free, and a page can exist ONLY in a derived section, so
      // skipping it would lose that page's title/label/description forever.
      if (!noFrontMatter) {
        const fmStat = newStat();
        harvestSectionFrontMatter(section, memory, fmStat, forceOverwrite, locale);
        for (const name of Object.keys(totals)) totals[name] += fmStat[name] || 0;
      }
      perSection[section.name] = {derived: true};
      continue;
    }
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const stat = newStat();
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = path.join(overlayBase, rel);
      if (!fs.existsSync(overlayPath)) {
        stat.noOverlay++;
        continue;
      }
      if (!noFrontMatter) harvestFrontMatter(sourcePath, overlayPath, memory, stat, forceOverwrite, locale);
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
        if (!harvestable(span, translated)) {
          if (hasGluedToken(translated) || hasGluedToken(span.text)) stat.gluedRejected++;
          continue;
        }
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
        `existing=${stat.existing} noOverlay=${stat.noOverlay} fmAdded=${stat.fmAdded} ` +
        `gluedRejected=${stat.gluedRejected}\n`,
    );
  }
  process.stdout.write(
    `harvest: files=${totals.files} blocks=${totals.blocks} paired=${totals.paired} ` +
      `added=${totals.added} skippedShape=${totals.skippedShape} conflicts=${totals.conflicts}\n`,
  );
  process.stdout.write(
    `harvest frontmatter: paired=${totals.fmPaired} added=${totals.fmAdded} ` +
      `(title=${totals.fmAdded_title} label=${totals.fmAdded_label} ` +
      `description=${totals.fmAdded_description}) existing=${totals.fmExisting} ` +
      `conflicts=${totals.fmConflicts} forced=${totals.fmForced} ` +
      `productSkipped=${totals.fmProductSkipped} gluedRejected=${totals.fmGluedRejected}` +
      `${noFrontMatter ? ' (disabled: --no-frontmatter)' : ''}\n`,
  );
  process.stdout.write(
    `harvest glued: blocksRejected=${totals.gluedRejected}\n`,
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
  if (totals.added === 0 && totals.fmAdded === 0) {
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
  process.stdout.write(
    `harvest: wrote ${MODEL_MEMORY} (+${totals.added} blocks, +${totals.fmAdded} frontmatter)\n`,
  );
}

try {
  main();
} catch (error) {
  // A bad `--locale=` is a user error: one line, no stack trace.
  if (!(error instanceof LocaleError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
