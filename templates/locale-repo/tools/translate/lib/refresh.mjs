/**
 * Refresh the overlays whose English source changed.
 *
 * The pipeline used to have no per-page answer to "did this English page change
 * since we translated it?". A page whose source was edited simply kept its old
 * translation until a human noticed, and `apply` (which rebuilds a whole
 * section from the legacy corpus) was too blunt to run for one edited
 * paragraph.
 *
 * This module keeps that answer in `state/translation-state.json`, next to the
 * page it belongs to:
 *
 *   source_sha256   SHA-256 of the English `.md` file, bytes as published
 *   overlay_sha256  SHA-256 of the overlay this pipeline last wrote (optional,
 *                   recorded on every write, so a hand-edited overlay is
 *                   visible instead of silently trusted)
 *   source_blocks   one 8-hex fingerprint per English block, in order
 *
 * The page hash answers "did anything change"; the block fingerprints answer
 * "which blocks changed", which is what lets a refresh keep the wording of the
 * blocks that did not. `source_blocks` is 8 characters per block (~0.7 MB over
 * the whole tree) and is hashed after `normalize`, so a link that only changed
 * its `/docs/7.25/` prefix does not count as a new paragraph.
 *
 * A refresh rebuilds the page from the **new** source:
 *
 *   1. a block the translation memory knows is filled from the memory;
 *   2. a block whose English is byte-identical to the previous source reuses
 *      the previous overlay's wording (this is the `reused_overlay` case: the
 *      memory missed it, but the page already had a translation);
 *   3. anything else stays English and enters the normal translation queue.
 *
 * A page with no recorded hash is *bootstrapped*, not rebuilt: the first run
 * after this feature ships must not rewrite 4,692 pages. The one exception is a
 * page whose overlay demonstrably does not belong to the current source (most
 * of the overlay's Chinese maps, through the memory, to English that is no
 * longer in the page); that page is refreshed as well. The bootstrap heuristic
 * is deliberately conservative and is only used while a page has no hash.
 *
 * Safety valves:
 *   - with no translation memory the refresh is skipped with a warning and no
 *     page is touched (a rebuild without memory would turn Chinese pages back
 *     into English). A repo with no legacy `translation-memory.json` still has
 *     a usable memory when it commits `shards/*.json` ( zh-Hant today ), so the
 *     shards are built into the global TM and the refresh is NOT skipped;
 *   - a rebuild whose Chinese drops below 95% of what the previous overlay
 *     still supports is **not written**; the page is reported and retried.
 *     "Still supports" is measured with the memory's reverse index: the Chinese
 *     of blocks whose English survives in the new source. Content the new
 *     source deleted is not counted as a loss, and a page with no attributable
 *     wording falls back to the plain 95%-of-the-old-overlay rule.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  WORK_DIR,
  ensureDir,
  relative,
  walkMarkdown,
  writeFileAtomic,
} from './paths.mjs';
import {splitFrontMatter, readField, withFields, copyKeys, renderDocument} from './frontmatter.mjs';
import {translationProvenance} from './provenance.mjs';
import {
  BLOCK_HASH_WIDTH,
  blockHash,
  blockHashes,
  decodeBlockHashes,
  encodeBlockHashes,
  sha256Hex,
} from './digest.mjs';
import {normalize, splitBlockSpans, splitBlocks, isTranslatableProse} from './blocks.mjs';
import {
  isPreservedOverlay,
  rebuildChangedPage,
  repairAdmonitions,
  restoreStructureBlocks,
  alignImages,
  rebaseImages,
  rewriteLinks,
} from './apply.mjs';
import {
  createGlobalTm,
  loadTm,
  lookupBlockLines,
  lookupCommentKey,
  lookupTitle,
  translateTableLines,
} from './tm.mjs';
import {addHeadingAnchors} from './anchors.mjs';
import {translateCodeComments} from './code-comments.mjs';
import {applyInlineColors, loadInlineColors} from '../../sync/lib/inline-colors.mjs';
import {annotateDocumentTerms} from './term-annotate.mjs';
import {CJK_REGRESSION_RATIO, cjkCount} from './cjk.mjs';
import {loadPatch, applyReplacements} from './patches.mjs';
import {sidebarLabelZh} from './labels.mjs';
import {pageTitles} from './links.mjs';
import {currentVersion, versionForSection} from '../../sync/lib/versions.mjs';

/** A bootstrap page needs at least this many attributable blocks to be judged. */
export const BOOTSTRAP_MIN_BLOCKS = 20;
/** Below this share of attributable English the overlay is a different version. */
export const BOOTSTRAP_COVERAGE = 0.6;

// Re-exported: callers of the refresh pass already import from here, and the
// definitions belong to `digest.mjs` so `apply.mjs` can share them.
export {BLOCK_HASH_WIDTH, blockHash, blockHashes, encodeBlockHashes, decodeBlockHashes};

/** Read `config/translation.yml` (offline policy, never a secret). */
function config() {
  const file = path.join(REPO, 'config/translation.yml');
  if (!fs.existsSync(file)) return {};
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

/**
 * May a `translate` run refresh pages? `--refresh-changed` asks for it;
 * `config/translation.yml#refresh_changed: false` and
 * `TRANSLATE_REFRESH_CHANGED=0` turn it off without editing the workflow.
 */
export function refreshEnabled() {
  const env = String(process.env.TRANSLATE_REFRESH_CHANGED ?? '').trim();
  if (/^(?:0|false|off|no)$/i.test(env)) return false;
  return config().refresh_changed !== false;
}

/**
 * The memory a refresh may read.
 *
 * `createGlobalTm` merges the three stores and is tolerant of a missing legacy
 * file, so a locale repo that commits only shards (zh-Hant today) still gets a
 * memory and `--refresh-changed` can rebuild its changed pages. A second locale
 * reads its own `tm-global.<locale>.json` first and never falls back to the
 * Simplified store (the wording would be wrong). Only a repo with no memory at
 * all returns `{tm: null, reason}`, which is the caller's "skip refresh" warning.
 */
export function loadRefreshTm(locale = DEFAULT_TARGET_LOCALE, {workDir = WORK_DIR} = {}) {
  if (locale === DEFAULT_TARGET_LOCALE) {
    try {
      const tm = createGlobalTm({workDir, locale});
      if (tm.entries.size === 0) {
        return {tm: null, reason: `no translation memory for ${locale}`};
      }
      return {tm, reason: null};
    } catch (error) {
      return {tm: null, reason: error.message};
    }
  }
  const tm = loadTm(locale);
  if (tm) return {tm, reason: null};
  // No prebuilt tm-global.<locale>.json: build from this repo's own shards /
  // comment memory instead of skipping. Still never touches another locale's
  // wording. A genuinely empty result keeps the existing "no memory" warning.
  try {
    const built = createGlobalTm({workDir, locale});
    if (built.entries.size === 0) {
      return {tm: null, reason: `no translation memory for ${locale}`};
    }
    return {tm: built, reason: null};
  } catch (error) {
    return {tm: null, reason: error.message};
  }
}

/**
 * Chinese text -> the English blocks it was produced from.
 *
 * Only block entries that carry Chinese and are not identity entries are
 * indexed. A value shared by several English blocks is ambiguous and is kept
 * with every candidate; callers only reuse a unique match.
 */
export function reverseTranslations(tm) {
  const reverse = new Map();
  if (!tm?.entries) return reverse;
  for (const [key, entry] of tm.entries) {
    if (!key.startsWith('block\u0000') || entry.identity) continue;
    const chinese = normalize(entry.text);
    if (cjkCount(chinese) === 0) continue;
    const english = key.slice('block\u0000'.length);
    if (!reverse.has(chinese)) reverse.set(chinese, []);
    reverse.get(chinese).push(english);
  }
  return reverse;
}

/**
 * Longest-common-subsequence alignment of two block-fingerprint lists.
 *
 * Returns `Map<newIndex, oldIndex>` for the blocks that are identical in both.
 * Added or rewritten blocks simply have no entry, which is what keeps a changed
 * paragraph from being handed its neighbour's translation.
 */
export function alignBlockHashes(oldHashes, newHashes) {
  const oldList = oldHashes || [];
  const newList = newHashes || [];
  const n = newList.length;
  const m = oldList.length;
  const pairs = new Map();
  if (n === 0 || m === 0) return pairs;
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        newList[i] === oldList[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (newList[i] === oldList[j]) {
      pairs.set(i, j);
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * How much of the previous overlay's Chinese the new source still supports.
 *
 * The exact answer comes from the block fingerprints: an overlay block whose
 * English is still a block of the new source contributes its CJK count. When
 * the page has no fingerprints yet (the first refresh after this feature
 * shipped, or an overlay whose block count no longer matches the recorded
 * source) the memory's reverse index is used instead. A page with neither is
 * judged against its whole previous overlay, i.e. the plain 95% rule.
 *
 * Content the new source deleted is deliberately not counted: replacing a
 * deleted paragraph with nothing is a correct refresh, not a CJK regression.
 */
export function preservedCjk({overlayBody, sourceBody, reverse, previousHashes = [], overlayBlocks = null}) {
  const oldBody = String(overlayBody ?? '');
  const nextHashes = blockHashes(sourceBody);
  const oldBlocks = overlayBlocks || splitBlocks(oldBody);
  if (previousHashes.length > 0 && previousHashes.length === oldBlocks.length) {
    const stillThere = new Set(nextHashes);
    let budget = 0;
    for (let index = 0; index < previousHashes.length; index++) {
      if (!stillThere.has(previousHashes[index])) continue;
      budget += cjkCount(oldBlocks[index]);
    }
    return {budget, mapped: previousHashes.length, attributed: 'blocks'};
  }
  const sourceBlocks = new Set(splitBlockSpans(String(sourceBody ?? '')).map((span) => normalize(span.text)));
  let mapped = 0;
  let budget = 0;
  for (const block of splitBlocks(oldBody)) {
    const count = cjkCount(block);
    if (count === 0) continue;
    const english = reverse.get(normalize(block));
    if (!english) continue;
    mapped += 1;
    if (english.some((candidate) => sourceBlocks.has(normalize(candidate)))) budget += count;
  }
  if (mapped === 0) return {budget: cjkCount(oldBody), mapped, attributed: 'overlay'};
  return {budget, mapped, attributed: 'memory'};
}

/** Blocks that are still English prose in a rebuilt body. */
function pendingBlockCount(body) {
  let count = 0;
  for (const span of splitBlockSpans(body)) {
    if (span.code) continue;
    if (isTranslatableProse(span.text)) count += 1;
  }
  return count;
}

/**
 * Does the overlay belong to a different version of this page?
 *
 * Used only while a page has no `source_sha256`. Most of the overlay's Chinese
 * should map back (through the memory) to English the page still contains; a
 * CLI table or a hardware page can score lower without being stale, so the
 * judgement needs both a minimum number of attributable blocks and a wide
 * margin.
 */
function looksLikeDifferentSource({overlayBody, sourceBody, reverse}) {
  const sourceBlocks = new Set(splitBlockSpans(String(sourceBody ?? '')).map((span) => normalize(span.text)));
  let mapped = 0;
  let inSource = 0;
  for (const block of splitBlocks(String(overlayBody ?? ''))) {
    if (cjkCount(block) === 0) continue;
    const english = reverse.get(normalize(block));
    if (!english) continue;
    mapped += 1;
    if (english.some((candidate) => sourceBlocks.has(normalize(candidate)))) inSource += 1;
  }
  if (mapped < BOOTSTRAP_MIN_BLOCKS) return {stale: false, mapped, coverage: 1};
  const coverage = inSource / mapped;
  return {stale: coverage < BOOTSTRAP_COVERAGE, mapped, coverage};
}

/** The section entry's key, which is also its source path. */
function sourceKey(section, rel) {
  return `${section.source}/${rel}`;
}

/**
 * Rebuild one page from its new source.
 *
 * Pure with respect to the repository: it returns the bytes it *would* write,
 * plus the counters the caller reports. Nothing is written here.
 */
function rebuildPage({
  section,
  rel,
  source,
  overlay,
  entry,
  tm,
  reverse,
  locale,
}) {
  const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
  const {frontMatter: overlayFm, body: overlayBody} = splitFrontMatter(overlay);
  const patch = loadPatch(locale, section.name, rel);
  const lookup = (block) => {
    if (patch && patch.keepEnglish.has(normalize(block))) return block;
    return lookupBlockLines(tm, block);
  };

  // A block whose fingerprint is unchanged can keep the previous overlay's
  // wording even when the memory has no entry for it. The positional map is
  // only trusted when the overlay was written from exactly these blocks, which
  // is why the block count is part of the check.
  const previousHashes = decodeBlockHashes(entry?.source_blocks);
  const overlayBlocks = splitBlocks(overlayBody);
  const reusable = new Map();
  const aligned = previousHashes.length > 0 && previousHashes.length === overlayBlocks.length;
  if (aligned) {
    const nextHashes = blockHashes(sourceBody);
    for (const [nextIndex, oldIndex] of alignBlockHashes(previousHashes, nextHashes)) {
      const previous = overlayBlocks[oldIndex];
      if (!previous || cjkCount(previous) === 0) continue;
      reusable.set(nextHashes[nextIndex], previous);
    }
  }
  const reuse = (block) => reusable.get(blockHash(block)) ?? null;

  const rebuilt = rebuildChangedPage(sourceBody, {lookup, reuse});
  let body = rebuilt.body;

  // The same offline finishing passes `apply` runs, so a refreshed page and a
  // rebuilt page end up byte-compatible (links, images, anchors, colours,
  // code-comment wording, patch replacements).
  const table = translateTableLines(tm, body);
  body = table.body;
  const admonitions = repairAdmonitions(body, sourceBody, lookup);
  body = admonitions.body;
  body = restoreStructureBlocks(sourceBody, body);
  const version = versionForSection(section.name) ?? currentVersion();
  body = rewriteLinks(body, {
    version,
    section,
    fromFile: rel,
    titleFor: (target) => pageTitles(section, target),
  });
  body = alignImages(sourceBody, body);
  body = rebaseImages(
    path.posix.dirname(`${section.source}/${rel}`),
    `${section.overlay}/${rel}`,
    body,
  );
  body = applyReplacements(body, patch);
  body = translateCodeComments(body, (key) => lookupCommentKey(tm, key)).body;
  body = addHeadingAnchors(body, sourceBody).body;
  body = applyInlineColors(body, loadInlineColors(version)[rel.replace(/\.md$/i, '')]).body;

  // Front matter follows the same rules as `apply`: the source's own keys stay
  // byte-identical, only the three translatable fields change. A title or
  // description the memory does not know keeps the Chinese the page already
  // had (English metadata is worse than a probably-slightly-old title), and
  // falls back to English only when there is no Chinese at all.
  const sourceTitle = readField(sourceFm, 'title');
  const oldTitle = readField(overlayFm, 'title');
  const titleZh =
    (patch && patch.title) ||
    (tm ? lookupTitle(tm, sourceTitle) : null) ||
    (cjkCount(oldTitle) > 0 ? oldTitle : null);
  const sourceDescription = readField(sourceFm, 'description');
  const oldDescription = readField(overlayFm, 'description');
  const descriptionZh =
    (sourceDescription && tm ? lookupTitle(tm, sourceDescription) : null) ||
    (cjkCount(oldDescription) > 0 ? oldDescription : null);
  const englishLabel = readField(sourceFm, 'sidebar_label');
  const oldLabel = readField(overlayFm, 'sidebar_label');
  let sidebarZh = englishLabel
    ? sidebarLabelZh({englishLabel, englishTitle: sourceTitle, zhTitle: titleZh})
    : null;
  if (englishLabel && cjkCount(sidebarZh) === 0 && cjkCount(oldLabel) > 0) sidebarZh = oldLabel;
  let frontMatter = copyKeys(
    withFields(sourceFm, {
      title: titleZh && titleZh !== sourceTitle ? titleZh : null,
      sidebar_label: sidebarZh || null,
      description: cjkCount(descriptionZh) > 0 ? descriptionZh : sourceDescription,
      ...translationProvenance({existing: overlayFm}),
    }),
    sourceFm,
  );
  const annotated = annotateDocumentTerms(frontMatter, body.trim());
  frontMatter = annotated.frontMatter;
  body = annotated.body;

  const pending = pendingBlockCount(body);
  return {
    sourceFm,
    sourceBody,
    overlayFm,
    overlayBody,
    frontMatter,
    body,
    pending,
    tmHits: rebuilt.tmHits + table.changed + admonitions.fixed,
    reused: rebuilt.reused,
    english: rebuilt.misses,
    patch,
  };
}

/**
 * Scan every source page, refresh the ones whose English changed, and report.
 *
 * `dryRun` writes neither the overlay nor the state. `tm` may be null, in which
 * case the run reports `skipped` and touches nothing.
 */
export function refreshChanged({
  sections,
  state,
  tm = null,
  repo = REPO,
  only = null,
  files = null,
  dryRun = false,
  log = (line) => process.stdout.write(`${line}\n`),
  warn = (line) => process.stderr.write(`${line}\n`),
  locale = null,
  reverse = null,
}) {
  const summary = {
    dryRun,
    skipped: false,
    reason: null,
    scanned: 0,
    unchanged: 0,
    baselined: 0,
    created: 0,
    preserved: 0,
    stale: 0,
    rebuilt: 0,
    blocked: 0,
    /** True when this run changed `state` and the caller has to write it. */
    dirty: false,
    pages: [],
    tmHits: 0,
    reusedOverlay: 0,
    pendingBlocks: 0,
  };
  if (!tm) {
    summary.skipped = true;
    summary.reason = 'translation memory unavailable';
    warn(`warning: refresh skipped: ${summary.reason}; overlays were not touched`);
    return summary;
  }
  const reverseIndex = reverse || reverseTranslations(tm);
  state.files = state.files || {};

  for (const section of sections) {
    const sectionLocale = locale || section.locale || DEFAULT_TARGET_LOCALE;
    const sourceBase = path.join(repo, section.source);
    const overlayBase = path.join(repo, section.overlay);
    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      if (only && rel !== only) continue;
      if (files && files.size > 0 && !files.has(rel)) continue;
      const key = sourceKey(section, rel);
      const entry = state.files[key];
      const overlayPath = path.join(overlayBase, rel);
      const source = fs.readFileSync(sourcePath, 'utf8');
      const sourceSha = sha256Hex(source);
      const {body: sourceBody} = splitFrontMatter(source);
      summary.scanned += 1;

      if (!fs.existsSync(overlayPath)) {
        // Nothing to preserve: the normal `translate` plan builds the page from
        // the source. Record the hash so a later edit is detected from day one.
        summary.created += 1;
        if (!dryRun) {
          summary.dirty = true;
          state.files[key] = {
            ...(entry || {}),
            section: section.name,
            source: key,
            overlay: `${section.overlay}/${rel}`,
            source_sha256: sourceSha,
            source_blocks: encodeBlockHashes(blockHashes(sourceBody)),
          };
        }
        continue;
      }

      if (isPreservedOverlay(rel, section.name)) {
        // A reviewed overlay listed in `config/translation.yml` is never
        // regenerated, by `apply` or by this refresh.
        summary.preserved += 1;
        continue;
      }

      const overlay = fs.readFileSync(overlayPath, 'utf8');
      const {body: overlayBody} = splitFrontMatter(overlay);
      const baseline = entry?.source_sha256 ?? null;
      let reason = null;
      if (baseline) {
        if (baseline === sourceSha) {
          summary.unchanged += 1;
          // Backfill the block fingerprints once, for pages written before this
          // field existed. The overlay bytes are not touched.
          if (!dryRun && !entry.source_blocks) {
            summary.dirty = true;
            state.files[key] = {
              ...entry,
              source_blocks: encodeBlockHashes(blockHashes(sourceBody)),
            };
          }
          continue;
        }
        reason = 'source-changed';
      } else {
        const judgement = looksLikeDifferentSource({overlayBody, sourceBody, reverse: reverseIndex});
        if (!judgement.stale) {
          summary.baselined += 1;
          if (!dryRun) {
            summary.dirty = true;
            state.files[key] = {
              ...(entry || {}),
              section: section.name,
              source: key,
              overlay: `${section.overlay}/${rel}`,
              source_sha256: sourceSha,
              overlay_sha256: sha256Hex(overlay),
              source_blocks: encodeBlockHashes(blockHashes(sourceBody)),
            };
            delete state.files[key].stale;
          }
          continue;
        }
        reason = 'no-baseline';
      }

      summary.stale += 1;
      const rebuilt = rebuildPage({
        section,
        rel,
        source,
        overlay,
        entry,
        tm,
        reverse: reverseIndex,
        locale: sectionLocale,
      });
      const nextCjk = cjkCount(rebuilt.body);
      const oldCjk = cjkCount(overlayBody);
      const preserved = preservedCjk({
        overlayBody,
        sourceBody,
        reverse: reverseIndex,
        previousHashes: decodeBlockHashes(entry?.source_blocks),
      });
      const lost = preserved.budget > 0 && nextCjk < preserved.budget * CJK_REGRESSION_RATIO;
      const detail = {
        section: section.name,
        rel,
        key,
        reason,
        blocks: splitBlockSpans(sourceBody).length,
        tmHits: rebuilt.tmHits,
        reused: rebuilt.reused,
        english: rebuilt.english,
        pending: rebuilt.pending,
        cjk: {old: oldCjk, next: nextCjk, budget: preserved.budget},
        guard: lost ? 'blocked' : 'ok',
        wrote: false,
      };
      if (dryRun) detail.body = rebuilt.body;

      if (lost) {
        summary.blocked += 1;
        warn(
          `refresh-blocked: ${section.overlay}/${rel} zh ${preserved.budget} -> ${nextCjk} ` +
            `(below ${Math.round(CJK_REGRESSION_RATIO * 100)}% of the wording the new source keeps); ` +
            'the previous overlay was kept',
        );
        if (!dryRun) {
          // Keep the previous `source_sha256` (so the page is retried) but leave
          // a trace: a page that stays blocked across batches means the memory
          // lost this page's entries, not that the page is fine.
          state.files[key] = {
            ...(entry || {}),
            refresh_blocked: {
              reason: 'cjk-regression',
              budget: preserved.budget,
              rebuilt: nextCjk,
              at: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
            },
          };
          summary.dirty = true;
        }
        summary.pages.push(detail);
        continue;
      }

      detail.wrote = !dryRun;
      summary.rebuilt += 1;
      summary.tmHits += rebuilt.tmHits;
      summary.reusedOverlay += rebuilt.reused;
      summary.pendingBlocks += rebuilt.pending;
      if (!dryRun) {
        ensureDir(path.dirname(overlayPath));
        const rendered = renderDocument(rebuilt.frontMatter, rebuilt.body.trim());
        writeFileAtomic(overlayPath, rendered);
        summary.dirty = true;
        state.files[key] = {
          ...(entry || {}),
          section: section.name,
          source: key,
          overlay: `${section.overlay}/${rel}`,
          status: rebuilt.pending === 0 ? 'full' : 'partial',
          pendingBlocks: rebuilt.pending,
          source_sha256: sourceSha,
          overlay_sha256: sha256Hex(rendered),
          source_blocks: encodeBlockHashes(blockHashes(rebuilt.sourceBody)),
          refreshed_at: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
          refresh: {
            reason,
            tm_hits: rebuilt.tmHits,
            reused_overlay: rebuilt.reused,
            english: rebuilt.english,
          },
        };
        delete state.files[key].stale;
        delete state.files[key].refresh_blocked;
      }
      summary.pages.push(detail);
      log(
        `${dryRun ? 'would-refresh' : 'refresh'} ${section.name}/${rel}: reason=${reason} ` +
          `blocks=${detail.blocks} tm=${rebuilt.tmHits} reused=${rebuilt.reused} ` +
          `english=${rebuilt.pending} cjk=${oldCjk}->${nextCjk} (keeps ${preserved.budget})`,
      );
    }
  }

  if (summary.stale > 0 && summary.blocked === 0 && summary.rebuilt === 0) summary.reason = 'nothing-written';
  if (summary.stale > 0 && summary.blocked > 0) summary.reason = 'cjk-regression';
  return summary;
}

/** One-line summary for the CLI, the `run.json` journal and the tests. */
export function formatRefreshSummary(summary) {
  if (!summary) return 'refresh: not run';
  if (summary.skipped) return `refresh: skipped (${summary.reason})`;
  return (
    `refresh: scanned=${summary.scanned} stale=${summary.stale} ` +
    `rebuilt=${summary.rebuilt} blocked=${summary.blocked} ` +
    `baselined=${summary.baselined} created=${summary.created} preserved=${summary.preserved} ` +
    `tm=${summary.tmHits} reused=${summary.reusedOverlay} pending=${summary.pendingBlocks}` +
    `${summary.dryRun ? ' (dry-run)' : ''}`
  );
}

/** Fields the batch journal keeps; the full per-page list stays in the log. */
export function refreshJournal(summary) {
  if (!summary) return null;
  const {pages, ...rest} = summary;
  return {...rest, blocked_pages: pages.filter((page) => page.guard === 'blocked').map((page) => page.key)};
}
