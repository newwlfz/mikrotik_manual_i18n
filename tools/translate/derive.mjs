#!/usr/bin/env node
/**
 * Derive one version's translation from another version's corrected one.
 *
 * The canonical version is reviewed by a human; every other version reuses the
 * canonical Chinese for each English block that is identical, so the same
 * paragraph reads the same way in every version. Blocks that only exist in the
 * target version fall back to the legacy memory, then stay English.
 *
 *   node tools/translate/derive.mjs --from=docs-7.24 --to=docs            # report
 *   node tools/translate/derive.mjs --from=docs-7.24 --to=docs --apply    # write
 *   node tools/translate/derive.mjs --locale=ru-RU --dry-run              # probe a locale
 *
 * `--locale` defaults to `zh-Hans`; every section path (source overlay and
 * target overlay) comes from `sectionsFor(locale)`, so the same chain can run
 * for another language without touching the version order. `--dry-run` is the
 * read-only form: it reports exactly what `--apply` would write and writes
 * nothing (it wins over `--apply`, and the report says `apply: false`).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  REPO,
  WORK_DIR,
  assertTranslationLocale,
  ensureDir,
  sectionsFor,
  walkMarkdown,
  relative,
} from './lib/paths.mjs';
import {splitFrontMatter, readField, withFields, copyKeys, renderDocument} from './lib/frontmatter.mjs';
import {translationProvenance} from './lib/provenance.mjs';
import {
  splitBlocks,
  normalize,
  translateBlocks,
  sameBlockShape,
  alignBlocks,
  isHorizontalRule,
  isImageBlock,
  retargetLinks,
} from './lib/blocks.mjs';
import {rewriteLinks, alignImages, rebaseImages, repairAdmonitions} from './lib/apply.mjs';
import {pageTitles} from './lib/links.mjs';
import {addHeadingAnchors} from './lib/anchors.mjs';
import {annotateDocumentTerms} from './lib/term-annotate.mjs';
import {translateCodeComments} from './lib/code-comments.mjs';
import {sidebarLabelZh} from './lib/labels.mjs';
import {applyInlineColors, loadInlineColors} from '../sync/lib/inline-colors.mjs';
import {normaliseMdxAnchors} from '../sync/lib/mdx-normalise.mjs';
import {
  createGlobalTm,
  loadTm,
  lookupBlockLines,
  lookupCommentKey,
  lookupTitle,
  translateTableLines,
} from './lib/tm.mjs';
import {CJK, digest} from './lib/legacy.mjs';
import {archivedVersions, versionForSection} from '../sync/lib/versions.mjs';

const STATE_FILE = path.join(REPO, 'state/translation-state.json');
const readState = () =>
  fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {schema: 1, sections: {}, files: {}};
const writeState = (state) => {
  fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true});
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 1)}\n`);
};

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply') && !DRY_RUN;
if (DRY_RUN && process.argv.includes('--apply')) {
  process.stderr.write('note: --dry-run overrides --apply; nothing will be written\n');
}

// A locale with a well-formed tag but no `docusaurus.config.ts` entry is only a
// naming convention so far: a read-only run may probe it, a write may not.
let LOCALE;
try {
  LOCALE = assertTranslationLocale(arg('locale', DEFAULT_TARGET_LOCALE), {readOnly: !APPLY});
} catch (error) {
  if (error instanceof LocaleError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

// The newest archive is the canonical source: it holds the most recently
// reviewed wording, so a new release only translates what actually changed.
const FROM = arg('from', `docs-${archivedVersions()[0]}`);
const TO = arg('to', 'docs');

const sections = sectionsFor(LOCALE);
const canonical = sections.find((section) => section.name === FROM);
const target = sections.find((section) => section.name === TO);
if (!canonical || !target) throw new Error(`unknown section: ${FROM} or ${TO}`);

function buildMemory(section) {
  const base = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  const memory = new Map();
  const titles = new Map();
  let files = 0;
  let pairs = 0;

  for (const file of walkMarkdown(base)) {
    const rel = relative(base, file);
    const overlay = path.join(overlayBase, rel);
    if (!fs.existsSync(overlay)) continue;
    const english = splitFrontMatter(fs.readFileSync(file, 'utf8'));
    const chinese = splitFrontMatter(fs.readFileSync(overlay, 'utf8'));
    files++;

    const enTitle = readField(english.frontMatter, 'title');
    const zhTitle = readField(chinese.frontMatter, 'title');
    if (enTitle && zhTitle && CJK.test(zhTitle)) titles.set(enTitle.trim(), zhTitle);

    const enBlocks = splitBlocks(english.body);
    const zhBlocks = splitBlocks(chinese.body);
    if (!enBlocks.length || !zhBlocks.length) continue;
    const mapping = sameBlockShape(enBlocks, zhBlocks)
      ? new Map(enBlocks.map((_, index) => [index, index]))
      : alignBlocks(enBlocks, zhBlocks);

    for (const [enIndex, zhIndex] of mapping) {
      const en = enBlocks[enIndex];
      const zh = zhBlocks[zhIndex];
      if (!en || !zh) continue;
      if (isHorizontalRule(en) || isImageBlock(en) || /^\s*(```|~~~)/.test(en)) continue;
      if (!CJK.test(zh)) continue;
      const key = normalize(en);
      if (!key) continue;
      if (!memory.has(key)) {
        memory.set(key, zh.trim());
        pairs++;
      }
    }
  }
  return {memory, titles, files, pairs};
}

const {memory, titles, files: canonicalFiles, pairs} = buildMemory(canonical);
// One merged store: model > legacy 7.24 > legacy 7.25, rebuilt from the three
// memory files on every run so a fresh `translate` is visible immediately.
//
// The merged stores are built from the zh-Hans memories, so a different locale
// must not fall back to them: its wording lives in `tm-global.<locale>.json`.
// When that file does not exist yet the run has no shared memory and only the
// locale's own canonical overlay can supply text.
const tm =
  LOCALE === DEFAULT_TARGET_LOCALE
    ? createGlobalTm({workDir: WORK_DIR})
    : loadTm(LOCALE) ?? {entries: new Map(), locale: LOCALE};

const sourceBase = path.join(REPO, target.source);
const overlayBase = path.join(REPO, target.overlay);
const stats = {files: 0, written: 0, blocks: 0, derived: 0, missing: 0};
const pending = [];
const state = readState();

for (const file of walkMarkdown(sourceBase)) {
  const rel = relative(sourceBase, file);
  const english = splitFrontMatter(fs.readFileSync(file, 'utf8'));
  const titleEn = readField(english.frontMatter, 'title');

  const result = translateBlocks(english.body, (block) => {
    const key = normalize(block);
    // The canonical overlay stays authoritative (`single-canonical`); the global
    // memory supplies everything the canonical version does not have.
    const local = memory.get(key);
    if (local !== undefined) {
      stats.derived++;
      return retargetLinks(local, block);
    }
    const shared = lookupBlockLines(tm, block);
    if (shared !== null) {
      stats.derived++;
      return retargetLinks(shared, block);
    }
    stats.missing++;
    return null;
  });
  stats.files++;
  stats.blocks += result.hits + result.misses;

  let body = result.body;
  // Derived pages reuse the canonical body, which can carry a mixed table
  // (translated rows, English header); fill the remaining English lines.
  const table = translateTableLines(tm, body);
  if (table.changed) {
    body = table.body;
    stats.derived += table.changed;
    result.hits += table.changed;
    result.misses = Math.max(0, result.misses);
  }
  // Same repair as `apply`: a glued warning is one segment, not one block.
  {
    const admonitions = repairAdmonitions(body, english.body, (block) => lookupBlockLines(tm, block));
    if (admonitions.fixed) body = admonitions.body;
  }
  body = normaliseMdxAnchors(body).body;
  // Relative `.md` links carry the release and the locale themselves; see
  // `lib/links.mjs` for why an absolute `/docs/...` URL cannot.
  body = rewriteLinks(body, {
    version: versionForSection(target.name),
    section: target,
    fromFile: rel,
    titleFor: (entry) => pageTitles(target, entry),
  });
  body = alignImages(english.body, body);
  body = rebaseImages(
    path.posix.dirname(`${target.source}/${rel}`),
    `${target.overlay}/${rel}`,
    body,
  );
  // Code comments come from the shared comment memory, so a line translated on
  // the canonical version reads the same in every derived version.
  const comments = translateCodeComments(body, (key) => lookupCommentKey(tm, key));
  body = comments.body;
  // Chinese headings keep the English ids so published anchors still resolve.
  const anchors = addHeadingAnchors(body, english.body);
  body = anchors.body;
  stats.anchorsAdded = (stats.anchorsAdded || 0) + anchors.added;

  const titleZh =
    titles.get((titleEn || '').trim()) || lookupTitle(tm, titleEn) || null;
  const englishLabel = readField(english.frontMatter, 'sidebar_label');
  let sidebarZh = englishLabel
    ? sidebarLabelZh({englishLabel, englishTitle: titleEn, zhTitle: titleZh})
    : null;
  // The rule above derives a label from the title; when it cannot (the English
  // label is not a prefix of the title and no catalogue maps it), it returns the
  // English label. A Chinese label the overlay already had is better than that
  // regression, so keep it: the label is a translated field, not a rebuild
  // product.
  if (englishLabel) {
    const overlayFile = path.join(overlayBase, rel);
    const existing = fs.existsSync(overlayFile)
      ? readField(splitFrontMatter(fs.readFileSync(overlayFile, 'utf8')).frontMatter, 'sidebar_label')
      : null;
    if (existing && CJK.test(existing) && (!sidebarZh || !CJK.test(sidebarZh))) sidebarZh = existing;
  }
  const englishDescription = readField(english.frontMatter, 'description');
  const descriptionZh = englishDescription ? lookupTitle(tm, englishDescription) : null;
  body = applyInlineColors(
    body,
    loadInlineColors(versionForSection(target.name))[rel.replace(/\.md$/i, '')],
  ).body;

  // `source` and `captured_at` are the English page's own facts; derive copies
  // them verbatim so the Chinese footer can print the capture time.
  // Keep the English description when this release's page never needed a run:
  // the key is part of the page contract (see `verify` frontMatterDiff) and the
  // tag pages read it, so an untranslated description is kept, never dropped.
  const translatedDescription =
    descriptionZh && /[\u4e00-\u9fff]/.test(descriptionZh) ? descriptionZh : englishDescription;
  let frontMatter = copyKeys(
    withFields(english.frontMatter, {
      title: titleZh && titleZh !== titleEn ? titleZh : null,
      sidebar_label: sidebarZh || null,
      description: translatedDescription,
      // The derived overlay is still a translation: record when it was written
      // and which provider/model supplied the wording.
      ...translationProvenance(),
    }),
    english.frontMatter,
  );

  const status = result.misses === 0 ? 'full' : 'partial';
  pending.push({rel, status, missing: result.misses});
  const key = `${target.source}/${rel}`;
  state.files[key] = {
    section: target.name,
    source: key,
    overlay: `${target.overlay}/${rel}`,
    mode: 'derived',
    sha256: digest(english.body),
    status,
    pendingBlocks: result.misses,
  };
  // `Back To Home` gets its explanation on first appearance only; the front
  // matter is scanned first so the title wins (see `term-annotate.mjs`).
  {
    const annotated = annotateDocumentTerms(frontMatter, body.trim());
    frontMatter = annotated.frontMatter;
    body = annotated.body;
  }
  if (APPLY) {
    const overlay = path.join(overlayBase, rel);
    ensureDir(path.dirname(overlay));
    fs.writeFileSync(overlay, renderDocument(frontMatter, body.trim()));
    stats.written++;
  }
}

if (APPLY) {
  state.sections[target.name] = {
    files: pending.length,
    full: pending.filter((entry) => entry.status === 'full').length,
    partial: pending.filter((entry) => entry.status === 'partial').length,
    stale: 0,
    missing: 0,
    pendingBlocks: pending.reduce((sum, entry) => sum + entry.missing, 0),
    updated_at: new Date().toISOString(),
  };
  writeState(state);
}

const worst = pending
  .filter((entry) => entry.missing > 0)
  .sort((a, b) => b.missing - a.missing)
  .slice(0, 10);

console.log(
  JSON.stringify(
    {
      from: FROM,
      to: TO,
      apply: APPLY,
      canonicalFiles,
      memoryEntries: pairs,
      targetFiles: stats.files,
      blocks: stats.blocks,
      derivedFromCanonical: stats.derived,
      stillEnglish: stats.missing,
      written: stats.written,
    },
    null,
    1,
  ),
);
if (worst.length) {
  console.log('pages with the most English left:');
  for (const entry of worst) console.log(`  ${entry.rel}: ${entry.missing}`);
}
