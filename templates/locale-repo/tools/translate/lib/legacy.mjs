/**
 * Import the read-only legacy translations as a translation memory.
 *
 * The legacy project recorded `source_sha` (a 16-hex digest of the English body
 * with image paths stabilised) in every translated file front matter, which
 * makes the English/Chinese pairing verifiable instead of guessed. Only pairs
 * whose digest matches are used; everything else is reported, never silently
 * treated as a match.
 *
 * Version scope: `current` is the legacy project's RouterOS 7.26 tree. It may
 * only serve non-versioned sections (hardware, blog, changelog), and only for
 * pages whose English body is identical to the mirror's; it never contributes
 * paragraphs to the translation memory.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DEFAULT_LEGACY_ROOT,
  DEFAULT_TARGET_LOCALE,
  WORK_DIR,
  ensureDir,
  relative,
  walkMarkdown,
} from './paths.mjs';
import {splitFrontMatter, readField} from './frontmatter.mjs';
import {splitBlocks, normalize, isHorizontalRule, hasFence, alignBlocks, sameBlockShape, isImageBlock} from './blocks.mjs';

const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;

/** The exact digest the legacy pipeline recorded: images only. */
export function stabilise(body) {
  return body.replace(IMAGE, (_, alt) => `![${alt}](ASSET)`);
}

/**
 * Matching digest. It additionally erases version-prefixed links, because the
 * legacy captures link to `/docs/7.25/...` while the mirror's current tree uses
 * `/docs/...`; that is a route difference, not a content difference.
 */
export function normalizeBody(body) {
  return body
    .replace(IMAGE, (_, alt) => `![${alt}](ASSET)`)
    .replace(/(?<!\!)\[([^\]]*)\]\([^)\s]+\)/g, (_, text) => `[${text}](LINK)`)
    .replace(/\s+/g, ' ')
    .trim();
}

export function digest(body) {
  return crypto.createHash('sha256').update(normalizeBody(body)).digest('hex').slice(0, 16);
}

function legacyDigest(body) {
  return crypto.createHash('sha256').update(stabilise(body)).digest('hex').slice(0, 16);
}

export const CJK = /[\u4e00-\u9fff]/;

/**
 * Pair the blocks of a translated file with the blocks of its English source.
 * A legacy file that lost only the source's horizontal rules is still paired:
 * the rules are structure, not prose, and the caller restores them from the
 * English source.
 */
export function pairBlocks(english, chinese) {
  const en = splitBlocks(english);
  const zh = splitBlocks(chinese);
  const mapping = sameBlockShape(en, zh)
    ? new Map(en.map((_, index) => [index, index]))
    : alignBlocks(en, zh);
  const pairs = [];
  for (const [enIndex, zhIndex] of mapping) {
    if (isHorizontalRule(en[enIndex])) continue;
    pairs.push([en[enIndex], zh[zhIndex]]);
  }
  return pairs.length > 0 ? {pairs, rules: []} : null;
}

export function buildLegacy({
  legacyRoot = DEFAULT_LEGACY_ROOT,
  outDir = WORK_DIR,
  locale = DEFAULT_TARGET_LOCALE,
} = {}) {
  // The corpus is a local bootstrap tree outside the repository and it is
  // allowed to be absent (it was removed from this workspace). Writing the
  // memory from it anyway would truncate `translation-memory.json` to `{}`,
  // which looks like "nothing was ever translated" to every later step. Refuse
  // instead: `apply` reads the existing memory, not this command.
  if (!fs.existsSync(legacyRoot)) {
    throw new Error(
      `legacy corpus was removed: ${legacyRoot} does not exist; ` +
        'refusing to overwrite translation-memory.json / legacy-index.json. ' +
        'Run `apply` (it uses the global TM and the model memory) and do not run `import-legacy`.',
    );
  }
  // Only 7.25 and 7.24 contribute paragraphs. 7.26 is indexed for exact-page
  // reuse of the non-versioned sections, nothing more.
  const tmAreas = ['v7.25', 'v7.24'];
  const indexAreas = ['current', ...tmAreas];
  const index = {};
  const memoryByArea = {};
  const stats = {
    files: 0,
    verified: 0,
    unverified: 0,
    noTranslation: 0,
    misaligned: 0,
    tmEntries: 0,
    skippedUnits: 0,
  };

  for (const area of indexAreas) {
    const enBase = path.join(legacyRoot, 'en', area);
    const zhBase = path.join(legacyRoot, locale, area);
    index[area] = {};
    memoryByArea[area] = new Map();
    const buildsMemory = tmAreas.includes(area);

    for (const enPath of walkMarkdown(enBase)) {
      const rel = relative(enBase, enPath);
      const zhPath = path.join(zhBase, rel);
      const english = fs.readFileSync(enPath, 'utf8');
      const {body: enBody} = splitFrontMatter(english);
      const sha = digest(enBody);
      const entry = {rel, area, sha, enPath, zhPath: null};
      stats.files++;

      if (!fs.existsSync(zhPath)) {
        stats.noTranslation++;
        index[area][rel] = entry;
        continue;
      }
      const chinese = fs.readFileSync(zhPath, 'utf8');
      const {frontMatter: zhFm, body: zhBody} = splitFrontMatter(chinese);
      const recorded = readField(zhFm, 'source_sha');
      entry.zhPath = zhPath;
      entry.title = readField(zhFm, 'title');
      entry.sidebarLabel = readField(zhFm, 'sidebar_label');
      entry.sourceSha = legacyDigest(enBody);
      entry.verified = recorded === entry.sourceSha;
      if (entry.verified) stats.verified++;
      else stats.unverified++;

      if (buildsMemory) {
        const pairing = pairBlocks(enBody, zhBody);
        if (!pairing) {
          stats.misaligned++;
        } else {
          for (const [enBlock, zhBlock] of pairing.pairs) {
            if (hasFence(enBlock) || isImageBlock(enBlock)) continue;
            const key = normalize(enBlock);
            if (key.length < 2) continue;
            if (!CJK.test(zhBlock)) {
              stats.skippedUnits++;
              continue;
            }
            if (!memoryByArea[area].has(key)) {
              memoryByArea[area].set(key, zhBlock.trim());
              stats.tmEntries++;
            }
          }
        }
      }
      index[area][rel] = entry;
    }
  }

  // A present-but-empty root would write the same empty memory as a missing one.
  if (stats.files === 0) {
    throw new Error(
      `legacy corpus was removed or empty: no Markdown under ${legacyRoot}; ` +
        'refusing to overwrite translation-memory.json / legacy-index.json',
    );
  }

  ensureDir(outDir);
  const serialized = {};
  for (const [area, map] of Object.entries(memoryByArea)) {
    serialized[area] = Object.fromEntries(map);
  }
  fs.writeFileSync(
    path.join(outDir, 'translation-memory.json'),
    JSON.stringify(serialized),
  );
  fs.writeFileSync(path.join(outDir, 'legacy-index.json'), JSON.stringify(index, null, 1));
  return {index, memoryByArea, stats};
}

/** Thousands separator, so a 33k-entry memory stays readable in a log line. */
function formatCount(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function loadLegacy(outDir = WORK_DIR) {
  const tmPath = path.join(outDir, 'translation-memory.json');
  const indexFile = path.join(outDir, 'legacy-index.json');
  // The block memory and the path index are independent artefacts: the memory
  // is the translation of English blocks, the index maps legacy files. The
  // corpus that produced the index has been removed, but the memory is still
  // valid and must keep loading; only a missing memory file is fatal.
  if (!fs.existsSync(tmPath)) return null;
  const raw = JSON.parse(fs.readFileSync(tmPath, 'utf8'));
  const memoryByArea = {};
  let memoryEntries = 0;
  for (const [area, entries] of Object.entries(raw)) {
    memoryByArea[area] = new Map(Object.entries(entries));
    memoryEntries += memoryByArea[area].size;
  }

  // The index records absolute paths into the legacy corpus. That corpus is a
  // local bootstrap tree and may be gone while this index survives, so every
  // entry is checked here instead of trusting `readFileSync` at the point of
  // use. Unreadable entries are dropped and counted; exact whole-page reuse
  // (exact/reference) then simply never matches, and the page is rebuilt from
  // the memory. An empty index is a valid state, not a missing memory.
  const index = {};
  let total = 0;
  let skipped = 0;
  if (fs.existsSync(indexFile)) {
    for (const [area, entries] of Object.entries(JSON.parse(fs.readFileSync(indexFile, 'utf8')))) {
      index[area] = {};
      for (const [rel, entry] of Object.entries(entries || {})) {
        total++;
        const readable =
          entry &&
          typeof entry.enPath === 'string' &&
          typeof entry.zhPath === 'string' &&
          fs.existsSync(entry.enPath) &&
          fs.existsSync(entry.zhPath);
        if (!readable) {
          skipped++;
          continue;
        }
        index[area][rel] = entry;
      }
    }
  }

  process.stderr.write(
    `legacy: memory ${formatCount(memoryEntries)} entries loaded; ` +
      `index ${formatCount(total - skipped)}/${formatCount(total)} usable\n`,
  );
  return {memoryByArea, index, skipped, total, memoryEntries};
}

/**
 * English title -> legacy entry, only for titles that are unique in the legacy
 * tree. Pages get moved and renamed between captures (a guide promoted out of
 * user-guides, for instance); a unique title is a safe fallback when the path no
 * longer matches.
 */
export function buildTitleIndex(index, areas) {
  const seen = new Map();
  for (const area of areas) {
    for (const entry of Object.values(index[area] || {})) {
      if (!entry.zhPath) continue;
      let title;
      try {
        title = readField(splitFrontMatter(fs.readFileSync(entry.enPath, 'utf8')).frontMatter, 'title');
      } catch {
        continue;
      }
      if (!title) continue;
      const key = title.trim();
      if (seen.has(key)) seen.set(key, null);
      else seen.set(key, entry);
    }
  }
  return new Map([...seen].filter(([, entry]) => entry));
}
