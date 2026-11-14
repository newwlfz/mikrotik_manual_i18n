#!/usr/bin/env node
/**
 * zh-Hans translation pipeline for the mirror.
 *
 *   node tools/translate/index.mjs import-legacy [--legacy-root=DIR]
 *       Build the translation memory and legacy index from the read-only
 *       legacy projects. No network, no model.
 *
 *   node tools/translate/index.mjs apply [--dry-run] [--section=NAME] [--allow-cjk-loss]
 *       Write i18n/zh-Hans overlays. Offline: exact legacy pages are reused
 *       verbatim (with the dropped horizontal rules restored) and changed pages
 *       are assembled block by block from the translation memory. A page that
 *       would end up with fewer Chinese characters than its current overlay is
 *       kept as is (`preserved`), unless `--allow-cjk-loss` says the loss is
 *       intended.
 *
 *   node tools/translate/index.mjs verify [--no-compile] [--locale=TAG] [--all-locales]
 *       Check file parity, code fences, images, front matter and MDX. Without
 *       arguments it checks the default locale (`zh-Hans`), byte for byte as
 *       before; `--locale` checks one target, `--all-locales` every configured
 *       target that has resources, and one failing locale fails the run.
 *
 *   node tools/translate/index.mjs comments [--dry-run] [--limit=N] [--section=NAME]
 *       Translate the line-leading `#` comments of allowed code fences and store
 *       them in the comment memory. Only comment text is sent, never code.
 *
 *   node tools/translate/index.mjs tm [--dry-run]
 *       Merge the legacy, model and comment memories into one global memory
 *       keyed by "kind + normalised English", and write a dry-run report of what
 *       switching to it would change. `--dry-run` skips writing the TM file.
 *
 *   node tools/translate/index.mjs status
 *       Print coverage from state/translation-state.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  SECTIONS,
  DEFAULT_TARGET_LOCALE,
  LocaleError,
  assertTranslationLocale,
  localeHasResources,
  sectionsFor,
  glossaryFile,
  localeRoot,
  patchDir,
  tmFile,
  REPO,
  WORKSPACE,
  WORK_DIR,
  walkMarkdown,
  relative,
  ensureDir,
} from './lib/paths.mjs';
import {buildLegacy, buildTitleIndex, CJK} from './lib/legacy.mjs';
import {applySection, cleanupOverlay, alignImages, rewriteLinks, rebaseImages} from './lib/apply.mjs';
import {resourceLocales, verify} from './lib/verify.mjs';
import {
  normalize,
  isTranslatableProse,
  fenceMask,
  splitBlocks,
  splitBlockSpans,
  codeParagraphs,
} from './lib/blocks.mjs';
import {languageText} from './lib/prose.mjs';
import {
  splitAdmonitions,
  renderAdmonition,
  bodyParagraphs,
  isTranslatableAdmonition,
  parseAdmonitionOpener,
  parseAdmonitionCloser,
} from './lib/admonitions.mjs';
import {splitFrontMatter, readField, withFields, renderDocument} from './lib/frontmatter.mjs';
import {annotateDocumentTerms} from './lib/term-annotate.mjs';
import {Client, loadConfig, USAGE_FILE} from './lib/provider.mjs';
import {loadPatch, applyReplacements} from './lib/patches.mjs';
import {loadModelMemory, saveModelMemory} from './lib/model-memory.mjs';
import {loadCommentMemory, saveCommentMemory} from './lib/comment-memory.mjs';
import {buildGlobalTm, createGlobalTm, lookupBlock, lookupTitle, serializeTm, saveTm} from './lib/tm.mjs';
import {isLegal} from './lib/legal.mjs';
import {
  commentLines,
  classifyComment,
  commentKey,
  translateCodeComments,
} from './lib/code-comments.mjs';

const STATE_FILE = path.join(REPO, 'state/translation-state.json');

/** True for the versioned RouterOS docs sections (`docs`, `docs-7.24`, ...). */
function isDocsSection(section) {
  return section.source === 'docs' || section.source.startsWith('versioned_docs/version-');
}

/** Options whose value must be attached with `=`, as in `--section=hardware`. */
const VALUE_OPTIONS = new Set([
  'section',
  'limit',
  'legacy-root',
  'file',
  'files',
  'kinds',
  'concurrency',
  'locale',
]);

/** Commands that translate into a target locale (and therefore validate it). */
const LOCALE_COMMANDS = new Set([
  'import-legacy',
  'apply',
  'translate',
  'descriptions',
  'comments',
  'admonitions',
  'tm',
]);

const USAGE =
  'usage: node tools/translate/index.mjs <import-legacy|apply|verify|translate|descriptions|comments|tm|admonitions|status> [options]\n' +
  '       [--section=NAME] [--locale=NAME] [--all-locales] [--dry-run] [--adopt] [--allow-cjk-loss] [--limit=N] ...\n' +
  'note: an option value must be attached with "=" (--section=hardware); a space is not accepted.\n' +
  'note: --locale defaults to zh-Hans and must not be the source locale (en).\n' +
  'note: verify --all-locales and verify --locale are mutually exclusive.';

function parseArgs(argv) {
  const args = {_: []};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) {
      const name = match[1];
      if (match[2] === undefined) {
        if (VALUE_OPTIONS.has(name)) {
          throw new Error(`option --${name} needs a value written with "=" (--${name}=VALUE)\n${USAGE}`);
        }
        args[name] = true;
      } else if (match[2] === '' && VALUE_OPTIONS.has(name)) {
        // `--section=` used to read as a falsy value, so `apply` silently ran
        // every section instead of none.
        throw new Error(`option --${name} needs a non-empty value (--${name}=VALUE)\n${USAGE}`);
      } else {
        args[name] = match[2];
      }
      continue;
    }
    // The first bare word is the command. Any further bare word used to be
    // swallowed silently: `apply --section hardware` read `section` as boolean
    // `true`, selected zero sections and printed nothing while exiting 0.
    if (args._.length === 0) {
      args._.push(arg);
      continue;
    }
    throw new Error(`unexpected argument: ${arg}; option values must use "--name=value"\n${USAGE}`);
  }
  return args;
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {schema: 1, sections: {}, files: {}};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function writeState(state) {
  state.generated_at = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
  fs.mkdirSync(path.dirname(STATE_FILE), {recursive: true});
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 1)}\n`);
}


const ENGLISH_WORD = /[A-Za-z]{3,}/;
const CODE_LINE = /^\s*(```+|~~~+)/;

/**
 * Text segments of a body, with every complete admonition kept as one part.
 *
 * The unit is `splitBlockSpans`, the same one `apply` and `verify` use. This
 * function used to re-implement the split on blank lines and to *skip* any part
 * that contained a fence line, so a paragraph the 7.25 capture glued directly
 * above a fence ("Example `connection-tracking-mode` configuration:" followed by
 * ``` with no blank line) was never queued, and a fence with a blank line inside
 * it produced two half-fence parts that were both skipped. Both shapes are now
 * ordinary blocks: the fence is one code block, the prose around it is prose.
 *
 * Every part is byte-addressable: the separators between blocks are their own
 * parts, so re-joining reproduces the body and a translated part can be swapped
 * back in without touching a single fence byte.
 */
function planParts(body) {
  const parts = [];
  let cursor = 0;
  for (const span of splitBlockSpans(body)) {
    if (span.start > cursor) parts.push({kind: 'sep', value: body.slice(cursor, span.start)});
    parts.push({
      kind: 'text',
      value: body.slice(span.start, span.end),
      admonition: Boolean(splitAdmonitions(span.text)),
      code: span.code,
    });
    cursor = span.end;
  }
  if (cursor < body.length) parts.push({kind: 'sep', value: body.slice(cursor)});
  // Re-joining must reproduce the page exactly; a drift here would rewrite
  // whitespace on every translated page.
  if (parts.map((part) => part.value).join('') !== body) {
    throw new Error('planParts lost bytes');
  }
  return parts;
}

/**
 * An admonition whose body still carries English paragraph(s) next to Chinese.
 *
 * The unit is the whole container: sending the mixed text makes the model return
 * one consistent translation, and `processItem` stores it under the English
 * source block, so `apply` can replace the mixed container.
 */
function isPartlyEnglishAdmonition(text) {
  const parts = splitAdmonitions(text);
  if (!parts || !parts.tail) return false;
  const english = (value) => {
    const flat = String(value).replace(/\s+/g, ' ').trim();
    if (!flat || CJK.test(languageText(flat))) return false;
    return (flat.match(/[A-Za-z]{2,}/g) || []).length >= 5;
  };
  // A command sample inside the warning is not prose. Counting it would make
  // every translated fenced admonition look "partly English" forever, so each
  // run would re-send it.
  const code = codeParagraphs(parts.body);
  return (
    bodyParagraphs(parts.body).some((paragraph) => !code.has(paragraph) && english(paragraph)) ||
    english(parts.title || '')
  );
}

/** Text segments of a body that are still English prose (fence-aware). */
function pendingSegments(body) {
  const parts = planParts(body);
  const indices = [];
  const blocks = [];
  const admonitions = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === 'sep') continue;
    // A fenced block is code, never a translation unit; `planParts` guarantees a
    // part never mixes code with prose.
    if (part.code) continue;
    const text = part.value;
    // A half-English admonition is invisible to `isTranslatableProse` (the part
    // already contains Chinese), so the very warning that `verify` reports could
    // never be queued. Treat it as a unit to translate as a whole.
    if (!isTranslatableProse(text) && !isPartlyEnglishAdmonition(text)) continue;
    indices.push(i);
    blocks.push(text);
    // Admonitions are counted apart from prose so a run can say how many warning
    // bodies are waiting, instead of hiding them inside the block total.
    if (isTranslatableAdmonition(text)) admonitions.push(text);
  }
  return {parts, indices, blocks, admonitions};
}

let planTm = null;

/** Blocks listed in config/force-translate.yml are never skipped as identity. */
function forcedBlocks() {
  const file = path.join(REPO, 'config/force-translate.yml');
  if (!fs.existsSync(file)) return new Set();
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return new Set((parsed.blocks || []).map((block) => normalize(String(block))));
}

/**
 * Which units one run may send: `blocks`, `title`, or both.
 *
 * A full run used to mean every pending unit in every section, which is the
 * right default for a fresh release but the wrong tool for a targeted repair:
 * a page whose title is still English and a page whose warning is still English
 * are different jobs with different costs. `--kinds` narrows the plan without
 * touching what `apply` / `derive` read.
 */
function parseKinds(raw) {
  if (!raw || raw === true) return {blocks: true, title: true};
  const names = String(raw)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) return {blocks: true, title: true};
  return {blocks: names.includes('blocks'), title: names.includes('title')};
}

function planSection(
  section,
  {
    limit,
    only,
    files,
    kinds = {blocks: true, title: true},
    locale = section.locale || DEFAULT_TARGET_LOCALE,
  },
) {
  const forced = forcedBlocks();
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  const items = [];
  for (const sourcePath of walkMarkdown(sourceBase)) {
    const rel = relative(sourceBase, sourcePath);
    if (only && rel !== only) continue;
    if (files && files.size && !files.has(rel)) continue;
    const overlayPath = path.join(overlayBase, rel);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
    const overlay = fs.existsSync(overlayPath)
      ? fs.readFileSync(overlayPath, 'utf8')
      : renderDocument(sourceFm, sourceBody);
    const {frontMatter: overlayFm, body: overlayBody} = splitFrontMatter(overlay);
    const patch = loadPatch(locale, section.name, rel);
    const planned = pendingSegments(overlayBody);
    const parts = planned.parts;
    const indices = planned.indices;
    // A block the memory "translates" to itself is technical notation (grammar,
    // identifiers) that must stay English; sending it again every run would burn
    // a request and come back unchanged.
    const skip = (block) => {
      if (forced.has(normalize(block))) return false;
      // An identity memory entry means "technical notation, keep English". A
      // warning that carries prose and a command sample is not notation: the
      // entry is a failed earlier attempt (or the same English block remembered
      // under another version), and skipping it is how 7.25 stayed English after
      // `docs` had already been translated.
      if (isFencedAdmonition(block)) return false;
      if (patch && patch.keepEnglish.has(normalize(block))) return true;
      if (!planTm) return false;
      const value = lookupBlock(planTm, block);
      return value !== null && normalize(value) === normalize(block);
    };
    const blocks = kinds.blocks ? planned.blocks.filter((block) => !skip(block)) : [];
    const admonitionBlocks = blocks.filter((block) => isTranslatableAdmonition(block));
    // Reported apart: these are the warnings that used to be invisible because
    // the whole block was classified as code.
    const fencedAdmonitions = blocks.filter((block) => isFencedAdmonition(block)).length;
    if (planned.blocks.length !== blocks.length || (patch && patch.keepEnglish.size)) {
      // keep the indices aligned with the filtered block list
      const kept = [];
      for (const index of planned.indices) {
        if (!skip(parts[index].value)) kept.push(index);
      }
      indices.length = 0;
      indices.push(...kept);
    }
    const cliPage = isDocsSection(section) && rel.startsWith('cli-reference/');
    const title = readField(overlayFm, 'title');
    const needsTitle = Boolean(
      kinds.title &&
        !(patch && patch.title) &&
        !cliPage &&
        title &&
        !CJK.test(title) &&
        !/^[a-z0-9/._-]+$/.test(title),
    );
    if (blocks.length === 0 && !needsTitle) continue;
    items.push({
      rel,
      overlayPath,
      sourceBody,
      overlayFm,
      overlayBody,
      parts,
      indices,
      blocks,
      admonitions: admonitionBlocks.length,
      fencedAdmonitions,
      admonitionSamples: admonitionBlocks.slice(0, 2).map((block) => block.split('\n')[0].trim()),
      needsTitle,
      title,
    });
    if (limit && items.length >= limit) break;
  }
  return items;
}

/**
 * Replace every fenced region of `translated` with the source's bytes.
 *
 * Fence count mismatch (the model invented or dropped a fence) falls back to
 * the whole source block: an English block is acceptable, a corrupted code
 * sample is not.
 */
function keepFences(source, translated) {
  if (!/(^|\n)\s*(```|~~~)/.test(source)) return translated;
  const ranges = (text) => {
    const lines = text.split('\n');
    const mask = fenceMask(text);
    const out = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!mask[i]) {
        if (start !== -1) {
          out.push([start, i - 1]);
          start = -1;
        }
        continue;
      }
      if (start === -1) start = i;
    }
    if (start !== -1) out.push([start, lines.length - 1]);
    return {lines, ranges: out};
  };
  const a = ranges(source);
  const b = ranges(translated);
  if (a.ranges.length !== b.ranges.length) return source;
  const lines = [...b.lines];
  for (let i = 0; i < a.ranges.length; i++) {
    const [from, to] = b.ranges[i];
    const replacement = a.lines.slice(a.ranges[i][0], a.ranges[i][1] + 1);
    lines.splice(from, to - from + 1, ...replacement);
    // Splice shifts later ranges; recompute the offset by the length delta.
    const delta = replacement.length - (to - from + 1);
    for (let j = i + 1; j < b.ranges.length; j++) {
      b.ranges[j][0] += delta;
      b.ranges[j][1] += delta;
    }
  }
  return lines.join('\n');
}

/**
 * Rebuild a translated admonition around the English container.
 *
 * The model may translate the `:::note` line, drop the closing `:::` or reflow
 * the paragraphs. When its reply still parses as the same container type, the
 * English container and markers are reproduced and only title/body text is taken
 * from the reply; otherwise the English block wins, because half an admonition
 * does not compile.
 */
function restoreAdmonition(english, translated) {
  const source = splitAdmonitions(english);
  if (!source) return translated;
  const target = splitAdmonitions(translated);
  if (!target || target.type !== source.type || target.tail === '') return english;
  const pairs = new Map();
  const add = (from, to) => {
    if (from && to) pairs.set(normalize(from), to);
  };
  add(source.title, target.title);
  const fromBody = bodyParagraphs(source.body);
  const toBody = bodyParagraphs(target.body);
  for (let i = 0; i < Math.min(fromBody.length, toBody.length); i++) add(fromBody[i], toBody[i]);
  return renderAdmonition(source, (text) => pairs.get(normalize(text)) ?? null);
}

/** A complete admonition whose body (or title) carries a fenced code sample. */
function isFencedAdmonition(block) {
  const parts = splitAdmonitions(block);
  return Boolean(parts && parts.tail !== '' && fenceMask(block).some(Boolean));
}

/** A translation usable as one paragraph, or null when it must be retried. */
function acceptsUnit(original, translated) {
  const value = String(translated ?? '').trim();
  if (!value || value === original) return null;
  // A translation carries Chinese. The model occasionally answers with an
  // English paraphrase or with the source plus a note ("Wait — I need to
  // translate. Let me output …"); neither is a translation, and writing it into
  // the page leaves English prose that the counters cannot see.
  if (!/[\u4e00-\u9fff]/.test(value)) return null;
  // One unit is one paragraph: a blank line inside the reply would split the
  // admonition body, and a fence would inject code into the container.
  if (/\n[ \t]*\n/.test(value)) return null;
  if (/(^|\n)\s*(?:`{3,}|~{3,})/.test(value)) return null;
  return value;
}

/** Translate one paragraph; one stricter retry when the reply is unusable. */
async function translateUnit(unit, client) {
  const first = acceptsUnit(unit, await client.chat(unit));
  if (first) return first;
  const retry = acceptsUnit(
    unit,
    await client.chat(
      'Translate this documentation paragraph to Simplified Chinese. Output only the translation, ' +
        'with no explanation, no notes, and without repeating the English: ' +
        unit,
    ),
  );
  return retry;
}

/**
 * Translate one warning that carries a code sample, unit by unit.
 *
 * Sending the whole `:::note … :::` block to the model hands it the command
 * inside the warning, and the model does translate command labels. The
 * container, the closing `:::` and every fenced paragraph are structure; only
 * the title and prose paragraphs are language. `renderAdmonition` already draws
 * that line when rebuilding, so the unit list is taken from it (by recording
 * the callbacks) instead of duplicating the rule here.
 */
async function translateFencedAdmonition(block, client) {
  const parts = splitAdmonitions(block);
  if (!parts) return block;
  const units = [];
  renderAdmonition(parts, (unit) => {
    units.push(unit);
    return null;
  });
  const code = codeParagraphs(parts.body);
  const translations = new Map();
  for (const unit of units) {
    if (code.has(unit)) continue;
    const translated = await translateUnit(unit, client);
    if (translated) translations.set(unit, translated);
  }
  if (translations.size === 0) return block;
  return renderAdmonition(parts, (unit) => translations.get(unit) ?? null);
}

async function processItem(section, item, client, state, modelMemory, commentMemory) {
  let body = item.overlayBody;
  const sent = item.blocks.length;

  if (item.blocks.length > 0) {
    // One request per batch: a page with a huge table exceeds what the endpoint
    // accepts if every block is sent at once ("fetch failed").
    const batchSize = Math.max(1, client.config?.batchSize || 8);
    let pieces = [];
    for (let cursor = 0; cursor < item.blocks.length; ) {
      // A warning with a code sample is translated by unit, never as one block:
      // the sample must stay byte-identical, and the model would rewrite it.
      if (isFencedAdmonition(item.blocks[cursor])) {
        pieces.push(await translateFencedAdmonition(item.blocks[cursor], client));
        cursor += 1;
        continue;
      }
      const batch = [];
      while (
        cursor < item.blocks.length &&
        batch.length < batchSize &&
        !isFencedAdmonition(item.blocks[cursor])
      ) {
        batch.push(item.blocks[cursor]);
        cursor += 1;
      }
      const prompt = batch.join('\n\n');
      let batchPieces = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const translated = await client.chat(prompt);
        batchPieces = translated.split(/\r?\n[ \t]*\r?\n/).filter((piece) => piece.trim() !== '');
        if (batchPieces.length !== batch.length) {
          // An admonition carries blank lines inside its own container, so the
          // plain separator split over-counts. Block structure is authoritative
          // and keeps the `:::type … :::` span together.
          const structured = splitBlocks(translated);
          if (structured.length === batch.length) batchPieces = structured;
        }
        if (batchPieces.length === batch.length) break;
        process.stderr.write(
          `retry ${section.name}/${item.rel}: ${batch.length} blocks -> ${batchPieces.length}\n`,
        );
      }
      if (batchPieces.length !== batch.length) {
        // A single oversized block (usually a wide table) can come back as many
        // pieces. Re-join them with single newlines: that restores the table
        // without inventing new blank-line blocks.
        if (batch.length === 1 && batchPieces.length > 1) {
          batchPieces = [batchPieces.join('\n')];
        } else {
          throw new Error(`block count ${batch.length} -> ${batchPieces.length}`);
        }
      }
      // A fenced block is copied verbatim. The model happily translates the
      // labels inside an ASCII diagram, which breaks the "code is byte-identical"
      // rule; restore every fence from the English source here, before writing.
      // An admonition is rebuilt around the English container for the same reason:
      // the `:::` markers are structure, only the title and body are language.
      pieces.push(
        ...batchPieces.map((piece, index) => {
          const block = batch[index];
          const kept = keepFences(block, piece);
          return splitAdmonitions(block) ? restoreAdmonition(block, kept) : kept;
        }),
      );
    }
    if (pieces.length !== item.blocks.length) {
      throw new Error(`block count ${item.blocks.length} -> ${pieces.length}`);
    }
    // The memory key must be the *English source* block, not the overlay text:
    // an overlay that still carries a half-translated warning would otherwise
    // store a key no rebuild can match, and the warning would flip back to
    // English on the next `apply`.
    // The memory key must be the English *source* block. A warning that is half
    // translated in the overlay cannot be matched by its own text: `apply` and
    // `derive` only ever look up the English block, so a key built from the
    // mixed overlay text is dead on arrival and the English paragraph comes
    // back on the next rebuild. Admonitions keep their source order, so pair
    // them by ordinal and accept the pair only when type and paragraph count
    // agree — a capture that dropped a container can shift the list.
    const sourceAdmonitions = splitBlocks(item.sourceBody).filter((block) => splitAdmonitions(block));
    const overlayAdmonitions = splitBlocks(item.overlayBody).filter((block) => splitAdmonitions(block));
    const sourceForKey = (block) => {
      const parts = splitAdmonitions(block);
      if (!parts) return null;
      const ordinal = overlayAdmonitions.findIndex((candidate) => normalize(candidate) === normalize(block));
      const source = ordinal === -1 ? null : sourceAdmonitions[ordinal];
      const sourceParts = splitAdmonitions(source || '');
      if (!sourceParts || sourceParts.type !== parts.type) return null;
      if (bodyParagraphs(sourceParts.body).length !== bodyParagraphs(parts.body).length) return null;
      return source;
    };
    for (let i = 0; i < item.indices.length; i++) {
      item.parts[item.indices[i]].value = pieces[i];
      if (!modelMemory) continue;
      const block = item.blocks[i];
      modelMemory.set(`${section.name}\u0000${normalize(block)}`, pieces[i].trim());
      const source = sourceForKey(block);
      if (source) modelMemory.set(`${section.name}\u0000${normalize(source)}`, pieces[i].trim());
    }
    body = item.parts.map((part) => part.value).join('');
  }

  const fields = {};
  // The front-matter `description` feeds `<meta name="description">` and the
  // tag pages (`/tags/<tag>`), so it is translated like the title.
  const sourceDescription = readField(item.sourceFm, 'description');
  if (sourceDescription) {
    const cached = modelMemory?.get(`description:${sourceDescription}`);
    if (cached) {
      fields.description = cached;
    } else {
      const value = await client.chat(
        `Translate this documentation description to Simplified Chinese. Output only the translation: "${sourceDescription}"`,
      );
      const clean = value.split('\n')[0].trim().replace(/^["']|["']$/g, '');
      if (clean && clean !== sourceDescription) {
        fields.description = clean;
        if (modelMemory) modelMemory.set(`description:${sourceDescription}`, clean);
      }
    }
  }
  if (item.needsTitle) {
    // Titles follow the page contract in `config/translation-rules.yml`
    // (title-terminology): product and protocol names stay English, the words
    // around them are Chinese. Without the rule the model translated `IGMP
    // Proxy` to `IGMP 代理` but also `Routing Decision` to `路由决策` only by
    // luck, and `EXP bit` came back as `EXP 位` on some runs.
    const value = await client.chat(
      `Translate this page title to Simplified Chinese. Output only the title: "${item.title}"\n` +
        'Keep product names, protocol names and technical proper nouns in English ' +
        '(RouterOS, MikroTik, OSPF, BGP, MPLS, IGMP, EXP, ROSv6/ROSv7, IPv4, VPN, CAPsMAN). ' +
        'Translate connectives and ordinary words: use 和 for "and" and 代理 for "Proxy".',
    );
    fields.title = value.split('\n')[0].trim().replace(/^["']|["']$/g, '') || item.title;
    if (modelMemory) modelMemory.set(`title:${item.title}`, fields.title);
    const label = readField(item.overlayFm, 'sidebar_label');
    if (label && label === item.title) fields.sidebar_label = fields.title;
  }

  const patch = loadPatch(section.locale || DEFAULT_TARGET_LOCALE, section.name, item.rel);
  const nextFm = withFields(item.overlayFm, {title: patch?.title || undefined, ...fields});
  body = rewriteLinks(body, section.stripVersion);
  body = alignImages(item.sourceBody, body);
  body = rebaseImages(
    path.posix.dirname(`${section.source}/${item.rel}`),
    `${section.overlay}/${item.rel}`,
    body,
  );
  body = applyReplacements(body, patch);
  body = translateCodeComments(body, (key) => commentMemory.get(key) ?? null).body;
  // `Back To Home` is annotated on its first appearance only (see
  // `lib/term-annotate.mjs`); doing it here keeps a freshly translated page and
  // a rebuilt one identical.
  const annotated = annotateDocumentTerms(nextFm, body.trim());
  ensureDir(path.dirname(item.overlayPath));
  fs.writeFileSync(item.overlayPath, renderDocument(annotated.frontMatter, annotated.body));

  const key = `${section.source}/${item.rel}`;
  const remaining = pendingSegments(body).blocks.length;
  state.files[key] = {
    ...(state.files[key] || {}),
    section: section.name,
    source: key,
    overlay: `${section.overlay}/${item.rel}`,
    status: remaining === 0 ? 'full' : 'partial',
    pendingBlocks: remaining,
  };
  return {sent, remaining};
}

async function translateSection(section, client, state, {limit, dryRun, only, files, kinds, modelMemory, commentMemory, concurrency = 4}) {
  const items = planSection(section, {limit, only, files, kinds});
  if (dryRun) {
    for (const item of items) {
      process.stdout.write(
        `${section.name}/${item.rel}: blocks=${item.blocks.length} admonitions=${item.admonitions}` +
          ` fencedAdmonitions=${item.fencedAdmonitions} title=${item.needsTitle ? 'yes' : 'no'}\n`,
      );
    }
    return {done: items.length, sentBlocks: items.reduce((sum, item) => sum + item.blocks.length, 0)};
  }

  let cursor = 0;
  let done = 0;
  let sentBlocks = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        const result = await processItem(section, item, client, state, modelMemory, commentMemory);
        sentBlocks += result.sent;
        done++;
        process.stdout.write(
          `${section.name}/${item.rel}: ${result.sent} blocks (${item.admonitions} admonitions, ` +
            `${item.fencedAdmonitions} with code), ${result.remaining} left\n`,
        );
      } catch (error) {
        process.stderr.write(`skip ${section.name}/${item.rel}: ${error.message}\n`);
      }
    }
  }
  const workers = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({length: workers}, worker));
  return {done, sentBlocks};
}

function renderTmReport(payload, report) {
  const lines = [];
  const out = (line = '') => lines.push(line);
  const counts = payload.counts || {};
  const kind = counts.byKind || {};
  const origin = counts.byOrigin || {};
  const conflicts = payload.conflicts || {total: 0, by_pair: {}, samples: []};

  out('# 全局翻译记忆 dry-run 报告');
  out();
  out(`生成时间：${payload.generated_at}`);
  out();
  out('本报告只合并记忆并统计影响，不修改任何 overlay。');
  out('`apply` / `derive` 已经读取这份合并记忆；报告用于审计合并结果与残留。');
  out();
  out('## 1. 合并结果');
  out();
  out('| 类别 | 条数 |');
  out('| --- | ---: |');
  out(`| 段落（block） | ${kind.block || 0} |`);
  out(`| 注释（comment） | ${kind.comment || 0} |`);
  out(`| 标题（title） | ${kind.title || 0} |`);
  out(`| 合计 | ${(kind.block || 0) + (kind.comment || 0) + (kind.title || 0)} |`);
  out();
  out('| 来源（最终保留） | 条数 |');
  out('| --- | ---: |');
  for (const [name, value] of Object.entries(origin).sort((a, b) => b[1] - a[1])) {
    out(`| ${name} | ${value} |`);
  }
  out();
  out(`同键不同译（被高优先级覆盖）：**${conflicts.total}** 条。`);
  if (conflicts.by_pair && Object.keys(conflicts.by_pair).length) {
    out();
    out('| 覆盖关系 | 条数 |');
    out('| --- | ---: |');
    for (const [pair, value] of Object.entries(conflicts.by_pair).sort((a, b) => b[1] - a[1])) {
      out(`| ${pair} | ${value} |`);
    }
  }
  out();
  out('## 2. 切换收益（只统计仍是英文的块）');
  out();
  out('“合规保留英文”指法规/型号等本就应当保留原文的块（译文等于原文）；');
  out('“保留原文”指记忆里有中文译文、但页面保留原文；多数是西班牙语/俄语/法语的法规声明，');
  out('按 `legal-text-english` 规则有意保留，需要人工确认是否有漏网之鱼。');
  out();
  out('| 板块 | 页面 | 英文块 | 合规保留英文 | 保留原文 | 全局可新增 | 仍缺译文 | 受影响页面 |');
  out('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [name, stat] of Object.entries(report.sections)) {
    out(
      `| ${name} | ${stat.pages} | ${stat.pending} | ${stat.policyEnglish} | ${stat.keptOriginal} | ` +
        `${stat.gain} | ${stat.untranslated} | ${stat.pagesAffected} |`,
    );
  }
  out(
    `| **合计** | | | **${report.totals.policyEnglish}** | **${report.totals.keptOriginal}** | ` +
      `**${report.totals.gain}** | **${report.totals.untranslated}** | **${report.totals.pagesAffected}** |`,
  );
  out();
  if (report.examples.length) {
    out('样例（原先没有译文的块）：');
    out();
    out('| 位置 | 英文 | 全局记忆 | 来源 |');
    out('| --- | --- | --- | --- |');
    for (const item of report.examples) {
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 90);
      out(`| ${item.section}/${item.rel} | ${cell(item.english)} | ${cell(item.chinese)} | ${item.origin} |`);
    }
    out();
  }
  if (report.missingExamples?.length) {
    out('### 仍缺译文的块');
    out();
    out('这些块在任何一层记忆里都没有译文：');
    out();
    out('| 位置 | 英文 |');
    out('| --- | --- |');
    for (const item of report.missingExamples) {
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 110);
      out(`| ${item.section}/${item.rel} | ${cell(item.english)} |`);
    }
    out();
  }

  out('## 3. 冲突样例（保留高优先级，丢弃低优先级）');
  out();
  if (!conflicts.samples?.length) {
    out('没有冲突。');
  } else {
    out('| 英文（截断） | 保留 | 丢弃 |');
    out('| --- | --- | --- |');
    for (const item of conflicts.samples.slice(0, 20)) {
      const english = item.key.split('\u0000').slice(1).join(' ');
      const cell = (text) =>
        String(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 60);
      out(`| ${cell(english)} | ${cell(item.kept)}（${item.kept_origin}） | ${cell(item.dropped)}（${item.dropped_origin}） |`);
    }
  }
  out();
  out('## 4. 结论');
  out();
  out(`- 合并后 ${payload.entries ? Object.keys(payload.entries).length : 0} 条，冲突 ${conflicts.total} 条；`);
  out(`- 合规保留英文 ${report.totals.policyEnglish} 块（不算漏翻）；`);
  out(`- 保留原文 ${report.totals.keptOriginal} 块（多为法规声明，需人工抽查）；`);
  out(`- 全局记忆可新增 ${report.totals.gain} 块，涉及 ${report.totals.pagesAffected} 页；`);
  out(`- 仍缺译文 ${report.totals.untranslated} 块。`);
  out('- 这一步不改 overlay；确认后再切换 apply / derive 的读取路径并重建。');
  out();
  return `${lines.join('\n')}\n`;
}

function targetLocale(args) {
  // A read-only run may probe a locale that is only conventional so far
  // (`--dry-run`); a write needs the locale enabled in docusaurus.config.ts.
  const readOnly = Boolean(args['dry-run']);
  return assertTranslationLocale(args.locale || DEFAULT_TARGET_LOCALE, {readOnly});
}

/** Print one `verify()` report; returns false when it must fail the run. */
function printVerifyReport(report) {
  for (const [name, stat] of Object.entries(report.summary)) {
    process.stdout.write(`${name}: ${JSON.stringify(stat)}\n`);
  }
  process.stdout.write(`mdxErrors=${report.mdxErrors.length} fences=${report.totalFences}\n`);
  process.stdout.write(
    `untranslatedAdmonitions=${report.totals?.untranslatedAdmonitions ?? 0}` +
      ` fencedAdmonitions=${report.totals?.fencedAdmonitionsEnglish ?? 0}` +
      `/${report.totals?.fencedAdmonitions ?? 0}` +
      `${report.admonitionSamples.length ? ` sample=${report.admonitionSamples[0]}` : ''}\n`,
  );
  if (report.mdxErrors.length) process.stdout.write(`${report.mdxErrors.slice(0, 15).join('\n')}\n`);
  for (const [name, stat] of Object.entries(report.sections)) {
    for (const kind of ['fenceDiff', 'commentDiff', 'imageDiff', 'frontMatterDiff']) {
      if (stat[kind].length) process.stdout.write(`${name} ${kind}: ${stat[kind].slice(0, 8).join('; ')}\n`);
    }
    if (stat.commentUntranslated) {
      process.stdout.write(`${name} commentUntranslated=${stat.commentUntranslated}\n`);
    }
  }
  for (const sample of report.untranslatedSamples) process.stdout.write(`untranslated: ${sample}\n`);
  for (const sample of report.commentSamples || []) process.stdout.write(`comment-untranslated: ${sample}\n`);
  // A zero exit code is what CI reads: a missing overlay, a blank overlay or an
  // MDX error used to print fine and pass anyway.
  const structural = Object.entries(report.summary).reduce(
    (sum, [, stat]) => sum + stat.missing + stat.extra + (stat.emptyOverlays || 0),
    0,
  );
  const ok = !structural && !report.mdxErrors.length;
  if (!ok) process.exitCode = 1;
  return ok;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const locale = LOCALE_COMMANDS.has(command) ? targetLocale(args) : DEFAULT_TARGET_LOCALE;
  const sections = LOCALE_COMMANDS.has(command) ? sectionsFor(locale) : SECTIONS;
  const selected = args.section
    ? sections.filter((section) => section.name === args.section)
    : sections;

  if (command === 'import-legacy') {
    process.stdout.write('Building translation memory from legacy projects…\n');
    const {stats} = buildLegacy({
      legacyRoot: args['legacy-root'],
      outDir: WORK_DIR,
      locale,
    });
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
    return;
  }

  if (command === 'apply') {
    if (!localeHasResources(locale)) {
      // A locale with no resource at all (no glossary, patches, TM file or
      // `i18n/<locale>/` tree) is only a naming convention so far. Applying it
      // would write an English mirror under `i18n/<locale>/`, which is never what
      // a probe run wants; report the zeroes a no-op run produces instead.
      const resources = [
        path.relative(REPO, glossaryFile(locale)),
        path.relative(REPO, patchDir(locale)),
        path.relative(WORKSPACE, tmFile(locale)),
        localeRoot(locale),
      ].join(', ');
      process.stdout.write(
        `locale ${locale}: no translation resources yet (${resources}); ` +
          `nothing to apply, would write under ${localeRoot(locale)}/\n`,
      );
      for (const section of selected) {
        process.stdout.write(
          `${section.name}: files=0 full=0 partial=0 stale=0 none=0 preserved=0 preservedCjk=0 ` +
            (args['dry-run'] ? 'wouldPreserveCjk=0 ' : '') +
            'cjkLossAllowed=0 pendingBlocks=0 commentHits=0 commentMisses=0 ' +
            'legacySkipped=0 orphansRemoved=0\n',
        );
      }
      return;
    }
    const {loadLegacy} = await import('./lib/legacy.mjs');
    // The block memory and the path index load independently. The corpus the
    // index points at has been removed, so the index may be empty while the
    // 33k-entry memory is still fully usable; only a missing memory file is
    // fatal (and `import-legacy` cannot rebuild it any more).
    const legacy = loadLegacy(WORK_DIR);
    const memoryFile = path.join(WORK_DIR, 'translation-memory.json');
    if (!legacy) {
      throw new Error(
        `translation memory missing: ${memoryFile} not found; ` +
          'the legacy corpus it was built from was removed, so `import-legacy` cannot rebuild it. ' +
          'Restore work/translate/ from a backup instead.',
      );
    }
    const modelMemory = loadModelMemory();
    const commentMemory = loadCommentMemory();
    const tm = createGlobalTm({workDir: WORK_DIR, locale});
    const state = readState();
    state.schema = 1;
    state.memory = legacy.memoryEntries;
    for (const section of selected) {
      // Merge only the memory of the areas this section is allowed to use, so a
      // 7.24 page can never inherit a 7.25 link or the other way round.
      const titleIndex = args.adopt ? buildTitleIndex(legacy.index, section.legacy) : null;
      const memory = new Map();
      for (const area of section.legacy) {
        for (const [key, value] of legacy.memoryByArea[area] || []) memory.set(key, value);
      }
      const result = applySection(section, memory, legacy.index, {
        write: !args['dry-run'],
        titleMemory: modelMemory,
        modelMemory,
        commentMemory,
        tm,
        adopt: Boolean(args.adopt),
        titleIndex,
        allowCjkLoss: Boolean(args['allow-cjk-loss']),
      });
      state.sections[section.name] = {
        files: result.files,
        full: result.full,
        partial: result.partial,
        stale: result.stale,
        missing: result.missing,
        preserved: result.preserved,
        preservedCjk: result.preservedCjk,
        cjkLossAllowed: result.cjkLossAllowed,
        pendingBlocks: result.pendingBlocks,
        commentHits: result.commentHits,
        commentMisses: result.commentMisses,
      };
      Object.assign(state.files, result.entries);
      const removed = args['dry-run'] ? 0 : cleanupOverlay(section, result);
      const preservedCjk = result.preservedCjk ?? 0;
      process.stdout.write(
        `${section.name}: files=${result.files} full=${result.full} partial=${result.partial} ` +
          `stale=${result.stale} none=${result.missing} preserved=${result.preserved ?? 0} ` +
          `preservedCjk=${preservedCjk} ` +
          (args['dry-run'] ? `wouldPreserveCjk=${preservedCjk} ` : '') +
          `cjkLossAllowed=${result.cjkLossAllowed ?? 0} ` +
          `pendingBlocks=${result.pendingBlocks} ` +
          `commentHits=${result.commentHits} commentMisses=${result.commentMisses} ` +
          `legacySkipped=${result.legacySkipped ?? 0} orphansRemoved=${removed}\n`,
      );
    }
    if (!args['dry-run']) writeState(state);
    return;
  }

  if (command === 'verify') {
    // `--all-locales` checks every configured target that has resources; an
    // explicit `--locale` checks one. Neither changes the no-argument output.
    if (args['all-locales'] && args.locale) {
      process.stderr.write('--all-locales and --locale are mutually exclusive\n');
      process.exitCode = 2;
      return;
    }
    if (args['all-locales']) {
      const locales = resourceLocales();
      if (!locales.length) {
        process.stdout.write('all-locales: no configured locale has translation resources yet\n');
        return;
      }
      const failed = [];
      for (const tag of locales) {
        process.stdout.write(`\n=== locale ${tag}\n`);
        const report = await verify({compile: !args['no-compile'], locale: tag});
        if (!printVerifyReport(report)) failed.push(tag);
      }
      process.stdout.write(
        `\nall-locales: checked ${locales.length} (${locales.join(', ')}); failed=${failed.length}` +
          `${failed.length ? ` (${failed.join(', ')})` : ''}\n`,
      );
      if (failed.length) process.exitCode = 1;
      return;
    }
    // `verify` is read-only, so a well-formed tag that is not in
    // `docusaurus.config.ts` yet is a valid probe.
    const tag = assertTranslationLocale(args.locale || DEFAULT_TARGET_LOCALE, {readOnly: true});
    const report = await verify({compile: !args['no-compile'], locale: tag});
    if (report.noResources) {
      process.stdout.write(
        `locale ${tag}: no translation resources yet; nothing to verify, 0 files under ${localeRoot(tag)}/\n`,
      );
    }
    printVerifyReport(report);
    return;
  }

  if (command === 'translate') {
    const config = loadConfig();
    const client = new Client(config);
    const state = readState();
    const modelMemory = loadModelMemory();
    const commentMemory = loadCommentMemory();
    planTm = createGlobalTm({workDir: WORK_DIR, locale});
    const limit = Number(args.limit || 20);
    let totalFiles = 0;
    let totalBlocks = 0;
    for (const section of selected) {
      const result = await translateSection(section, client, state, {
        limit,
        dryRun: Boolean(args['dry-run']),
        only: args.file,
        files: args.files ? new Set(String(args.files).split(',').map((value) => value.trim()).filter(Boolean)) : null,
        kinds: parseKinds(args.kinds),
        modelMemory,
        commentMemory,
        concurrency: Number(args.concurrency || 4),
      });
      totalFiles += result.done;
      totalBlocks += result.sentBlocks;
    }
    if (!args['dry-run']) {
      writeState(state);
      saveModelMemory(modelMemory);
      client.log(USAGE_FILE);
    }
    process.stdout.write(
      `translated files=${totalFiles} blocks=${totalBlocks} tokens(prompt/completion)=` +
        `${client.usage.prompt}/${client.usage.completion}\n`,
    );
    return;
  }


/**
 * Section-scoped memory, as `apply` uses it today.
 *
 * A derived section also reads the canonical version, because that is where its
 * wording comes from.
 */
function sectionMemory(section, legacy, model) {
  const local = new Map();
  for (const area of section.legacy || []) {
    for (const [key, value] of Object.entries(legacy[area] || {})) local.set(key, value);
  }
  if (section.derivedFrom) {
    const canonical = SECTIONS.find((item) => item.name === section.derivedFrom);
    for (const area of canonical?.legacy || []) {
      for (const [key, value] of Object.entries(legacy[area] || {})) {
        if (!local.has(key)) local.set(key, value);
      }
    }
  }
  return (english) => {
    const key = normalize(english);
    const generated = model.get(`${section.name}\u0000${key}`);
    if (generated !== undefined) return generated;
    return local.get(key) ?? null;
  };
}

/**
 * What switching to the global memory would change.
 *
 * Only the blocks that are still English today are counted: those are the ones
 * the global memory could fill for free. Blocks that already have Chinese keep
 * their wording, so a wording comparison would be a different (and much larger)
 * exercise.
 */
function tmDryRun(sections, built, legacy, model) {
  const bySection = {};
  let gain = 0;
  let pagesAffected = 0;
  let policyEnglish = 0;
  let keptOriginal = 0;
  let untranslated = 0;
  const examples = [];
  const keptExamples = [];
  const missingExamples = [];

  const identity = (text, english) => text !== null && normalize(text) === normalize(english);

  for (const section of sections) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const current = sectionMemory(section, legacy, model);
    const stat = {
      pages: 0,
      pending: 0,
      policyEnglish: 0,
      keptOriginal: 0,
      globalFillable: 0,
      gain: 0,
      untranslated: 0,
      pagesAffected: 0,
    };

    for (const sourcePath of walkMarkdown(sourceBase)) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = path.join(overlayBase, rel);
      const body = splitFrontMatter(
        fs.readFileSync(fs.existsSync(overlayPath) ? overlayPath : sourcePath, 'utf8'),
      ).body;
      const pending = pendingSegments(body).blocks;
      if (pending.length === 0) continue;
      stat.pages++;
      let pageGain = 0;
      for (const block of pending) {
        stat.pending++;
        const currentText = current(block);
        const globalEntry = built.entries.get(tmKeyOf(block));

        // Legal statements and identifiers are translated to themselves on
        // purpose; they are not misses.
        if (identity(currentText, block) || isLegal(block)) {
          stat.policyEnglish++;
          policyEnglish++;
          continue;
        }
        if (currentText !== null) {
          // The memory has a Chinese translation but the page keeps the source
          // text. That is correct for regulatory wording (Spanish, Russian,
          // French) and a real defect for anything else, so it is reported for a
          // human look rather than counted as a miss.
          stat.keptOriginal++;
          keptOriginal++;
          if (keptExamples.length < 12) {
            keptExamples.push({
              section: section.name,
              rel,
              english: block.trim().slice(0, 90),
              chinese: String(currentText).slice(0, 90),
            });
          }
          continue;
        }
        if (globalEntry && !identity(globalEntry.text, block)) {
          stat.globalFillable++;
          stat.gain++;
          gain++;
          pageGain++;
          if (examples.length < 12) {
            examples.push({
              section: section.name,
              rel,
              english: block.trim().slice(0, 90),
              chinese: globalEntry.text.slice(0, 90),
              origin: globalEntry.origin,
            });
          }
          continue;
        }
        // The memory only has an "identity" entry (keep English): policy, not
        // a missing translation.
        if (globalEntry && identity(globalEntry.text, block)) {
          stat.policyEnglish++;
          policyEnglish++;
          continue;
        }
        stat.untranslated++;
        untranslated++;
        if (missingExamples.length < 12) {
          missingExamples.push({section: section.name, rel, english: block.trim().slice(0, 120)});
        }
      }
      if (pageGain > 0) stat.pagesAffected++;
    }

    pagesAffected += stat.pagesAffected;
    bySection[section.name] = stat;
  }

  return {
    totals: {gain, pagesAffected, policyEnglish, keptOriginal, untranslated},
    sections: bySection,
    examples,
    keptExamples,
    missingExamples,
  };
}

function tmKeyOf(english) {
  return `block\u0000${normalize(english)}`;
}

const COMMENT_SYSTEM = `You translate comments that appear inside MikroTik RouterOS documentation code examples, from English to Simplified Chinese.

The input is a JSON array of comment lines, in page order. Return ONLY a JSON array of the same length, with the translation of each line at the same index.

Rules, in order of importance:
1. One output string per input string. Never merge two lines or split one line.
2. Never translate identifiers: RouterOS commands and menu paths, parameter and property names, enum values, IP and MAC addresses, version numbers, file names, URLs, e-mail addresses, and quoted strings that are values rather than prose.
3. Keep product and protocol names as written: RouterOS, MikroTik, CAPsMAN, MQTT, RADIUS, OpenVPN, WireGuard, IPsec, BGP, DHCPv6.
4. Keep the source line's trailing punctuation, especially a trailing colon.
5. Do not add numbering, quotation marks, Markdown or explanation.
6. Several lines may be one sentence split by the author: translate each as its own fragment without inventing context the other lines do not provide.
7. Output Simplified Chinese only; keep a line in English if it is a value, a keyword or a command.`;

function parseCommentArray(raw, count) {
  let text = String(raw ?? '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  let value;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== count) return null;
  if (!value.every((item) => typeof item === 'string' && item.trim() !== '')) return null;
  return value.map((item) => item.trim().replace(/^#+\s*/, '').replace(/\s*\r?\n\s*/g, ' '));
}

/**
 * Comment translation jobs.
 *
 * Adjacent comment lines are sent as one run, because upstream pages wrap a
 * sentence over several `#` lines and translating each line alone produces
 * fragments. Only lines missing from the comment memory form a job, and a job
 * that repeats across 7.24 and 7.25 is sent once.
 */
function commentPlan(sections, memory, {only} = {}) {
  const jobs = [];
  const seen = new Set();
  // A sentence can appear on several pages; translate it once.
  const pending = new Set();
  for (const section of sections) {
    const base = path.join(REPO, section.source);
    for (const sourcePath of walkMarkdown(base)) {
      const rel = relative(base, sourcePath);
      if (only && rel !== only) continue;
      const {body} = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8'));
      const entries = commentLines(body).filter(
        (entry) =>
          !entry.blockSkip &&
          classifyComment(entry.text, entry.next, entry.hashes.length).kind === 'comment',
      );
      let run = [];
      const emit = (lines) => {
        if (lines.length === 0) return;
        const dedupe = `${lines[0].language}\u0000${lines.map((line) => line.text.trim()).join('\u0001')}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        const fresh = [];
        for (const line of lines) {
          const key = commentKey(line.language, line.text);
          if (pending.has(key)) continue;
          pending.add(key);
          fresh.push({key, text: line.text.trim()});
        }
        if (fresh.length === 0) return;
        jobs.push({section: section.name, rel, language: lines[0].language, lines: fresh});
      };
      const flush = () => {
        let chunk = [];
        for (const entry of run) {
          if (memory.has(commentKey(entry.language, entry.text))) {
            emit(chunk);
            chunk = [];
            continue;
          }
          chunk.push(entry);
        }
        emit(chunk);
        run = [];
      };
      for (const entry of entries) {
        const previous = run[run.length - 1];
        if (
          previous &&
          entry.block === previous.block &&
          entry.index === previous.index + 1 &&
          entry.hashes === previous.hashes
        ) {
          run.push(entry);
        } else {
          flush();
          run = [entry];
        }
      }
      flush();
    }
  }
  return jobs;
}

/**
 * Take at most `limit` comment lines from the job list.
 *
 * `--limit` is the cost cap of one invocation: it counts comment lines sent, not
 * pages, because that is what the provider charges for.
 */
function takeLines(jobs, limit) {
  const out = [];
  let used = 0;
  for (const job of jobs) {
    if (used >= limit) break;
    const room = limit - used;
    const lines = job.lines.slice(0, room);
    out.push({...job, lines});
    used += lines.length;
  }
  return out;
}

/** Group comment runs into requests of at most `maxLines` comment lines. */
function batchJobs(jobs, maxLines = 30) {
  const batches = [];
  let current = {jobs: [], lines: []};
  for (const job of jobs) {
    if (current.lines.length > 0 && current.lines.length + job.lines.length > maxLines) {
      batches.push(current);
      current = {jobs: [], lines: []};
    }
    current.jobs.push(job);
    current.lines.push(...job.lines);
  }
  if (current.lines.length > 0) batches.push(current);
  return batches;
}

async function translateComments(sections, client, {limit, batch, dryRun, only}) {
  const memory = loadCommentMemory();
  const jobs = commentPlan(sections, memory, {only});
  const totalLines = jobs.reduce((sum, job) => sum + job.lines.length, 0);
  const characters = jobs.reduce(
    (sum, job) => sum + job.lines.reduce((n, line) => n + line.text.length, 0),
    0,
  );
  const budget = takeLines(jobs, Number(limit || 200));
  const batches = batchJobs(budget, Number(batch || 40));
  const planned = budget.reduce((sum, job) => sum + job.lines.length, 0);

  const summary = {
    jobs: jobs.length,
    lines: totalLines,
    characters,
    plannedLines: planned,
    batches: batches.length,
    sections: {},
  };
  for (const job of jobs) {
    summary.sections[job.section] = (summary.sections[job.section] || 0) + job.lines.length;
  }
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
    for (const [index, batch] of batches.slice(0, 5).entries()) {
      process.stdout.write(`batch ${index + 1}: lines=${batch.lines.length} jobs=${batch.jobs.length}\n`);
      for (const line of batch.lines.slice(0, 10)) process.stdout.write(`  ${line.text}\n`);
      if (batch.lines.length > 10) process.stdout.write(`  … ${batch.lines.length - 10} more\n`);
    }
    return summary;
  }

  let done = 0;
  let translated = 0;
  let skipped = 0;
  for (const batch of batches) {
    const prompt = JSON.stringify(batch.lines.map((line) => line.text), null, 1);
    let pieces = null;
    for (let attempt = 0; attempt < 2 && !pieces; attempt++) {
      const raw = await client.chat(prompt, {system: COMMENT_SYSTEM});
      pieces = parseCommentArray(raw, batch.lines.length);
      if (!pieces) {
        process.stderr.write(`retry comment batch ${done + 1}: expected ${batch.lines.length} lines\n`);
      }
    }
    if (!pieces) {
      skipped += batch.lines.length;
      process.stderr.write(`skip comment batch ${done + 1} (${batch.lines.length} lines): unparseable\n`);
      continue;
    }
    batch.lines.forEach((line, index) => memory.set(line.key, pieces[index]));
    saveCommentMemory(memory);
    done += 1;
    translated += pieces.length;
    const first = batch.jobs[0];
    process.stdout.write(
      `batch ${done}/${batches.length}: ${pieces.length} comments (${first.section}/${first.rel} …)\n`,
    );
  }
  process.stdout.write(
    `comments batches=${done}/${batches.length} lines=${translated} skipped=${skipped} ` +
      `tokens(prompt/completion)=${client.usage.prompt}/${client.usage.completion}\n`,
  );
  return {...summary, done, translated, skipped};
}

  if (command === 'descriptions') {
    const config = loadConfig();
    const client = new Client(config);
    const modelMemory = loadModelMemory();
    const tm = createGlobalTm({workDir: WORK_DIR, locale});
    const prompts = [];
    let skipped = 0;
    for (const section of selected) {
      const sourceBase = path.join(REPO, section.source);
      for (const file of walkMarkdown(sourceBase)) {
        const rel = relative(sourceBase, file);
        const {frontMatter} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
        const english = readField(frontMatter, 'description');
        if (!english) continue;
        if (modelMemory.get(`description:${english}`) || lookupTitle(tm, english)) {
          skipped++;
          continue;
        }
        prompts.push(english);
      }
    }
    process.stdout.write(`descriptions: ${prompts.length} to translate, ${skipped} already known\n`);
    if (!args['dry-run']) {
      const queue = [...new Set(prompts)];
      let done = 0;
      const worker = async () => {
        while (queue.length) {
          const english = queue.shift();
          const value = await client.chat(
            `Translate this documentation description to Simplified Chinese. Output only the translation: "${english}"`,
          );
          const clean = value.split('\n')[0].trim().replace(/^["']|["']$/g, '');
          if (clean && clean !== english) modelMemory.set(`description:${english}`, clean);
          done++;
          if (done % 25 === 0) process.stdout.write(`  ${done}/${prompts.length}\n`);
        }
      };
      await Promise.all(Array.from({length: Number(args.concurrency || 4)}, worker));
      saveModelMemory(modelMemory);
      client.log(USAGE_FILE);
      process.stdout.write(
        `translated ${done} description(s), tokens(prompt/completion)=${client.usage.prompt}/${client.usage.completion}\n`,
      );
    }
    return;
  }

  if (command === 'comments') {
    const config = loadConfig();
    const client = new Client(config);
    const summary = await translateComments(selected, client, {
      limit: args.limit,
      dryRun: Boolean(args['dry-run']),
      only: args.file,
    });
    if (!args['dry-run']) {
      client.log(USAGE_FILE);
      const mem = loadCommentMemory();
      process.stdout.write(`comment-memory=${mem.size}\n`);
    }
    void summary;
    return;
  }

  if (command === 'tm') {
    const legacy = JSON.parse(
      fs.readFileSync(path.join(WORK_DIR, 'translation-memory.json'), 'utf8'),
    );
    const modelRaw = JSON.parse(
      fs.readFileSync(path.join(WORK_DIR, 'model-memory.json'), 'utf8'),
    );
    const commentPath = path.join(WORK_DIR, 'comment-memory.json');
    const commentRaw = fs.existsSync(commentPath)
      ? JSON.parse(fs.readFileSync(commentPath, 'utf8'))
      : {entries: {}};

    const built = buildGlobalTm({legacy, model: modelRaw, comment: commentRaw});
    built.locale = locale;
    const payload = serializeTm(built, {locale});
    if (!args['dry-run']) saveTm(payload, {locale});

    const report = tmDryRun(selected, built, legacy, new Map(Object.entries(modelRaw)));
    const outJson = path.join(REPO, 'reports/tm-dry-run.json');
    const outMd = path.join(REPO, 'reports/tm-dry-run.md');
    ensureDir(path.dirname(outJson));
    fs.writeFileSync(outJson, `${JSON.stringify({generated_at: payload.generated_at, counts: built.counts, conflicts: payload.conflicts, ...report}, null, 1)}\n`);
    fs.writeFileSync(outMd, renderTmReport(payload, report));
    process.stdout.write(
      `tm entries=${built.entries.size} conflicts=${built.conflicts.length} ` +
        `gain=${report.totals.gain} kept=${report.totals.keptOriginal} ` +
        `policy=${report.totals.policyEnglish} missing=${report.totals.untranslated}` +
        `${args['dry-run'] ? ' (dry-run, tm not written)' : ''}\n`,
    );
    return;
  }

  if (command === 'admonitions') {
    // Read-only inventory: how many `:::type … :::` blocks exist and how many are
    // still queued. Before the block splitter learned the container, the queued
    // number was structurally zero on every page.
    let total = 0;
    let queued = 0;
    for (const section of selected) {
      const sourceBase = path.join(REPO, section.source);
      const overlayBase = path.join(REPO, section.overlay);
      let found = 0;
      let waiting = 0;
      const samples = [];
      for (const sourcePath of walkMarkdown(sourceBase)) {
        const rel = relative(sourceBase, sourcePath);
        const sourceBody = splitFrontMatter(fs.readFileSync(sourcePath, 'utf8')).body;
        const overlayPath = path.join(overlayBase, rel);
        const overlayBody = fs.existsSync(overlayPath)
          ? splitFrontMatter(fs.readFileSync(overlayPath, 'utf8')).body
          : sourceBody;
        found += pendingSegments(sourceBody).admonitions.length;
        const plan = pendingSegments(overlayBody);
        waiting += plan.admonitions.length;
        if (plan.admonitions.length && samples.length < 3) {
          samples.push(`${rel}: ${plan.admonitions[0].split('\n')[0].trim()}`);
        }
      }
      total += found;
      queued += waiting;
      process.stdout.write(
        `${section.name}: admonitions=${found} queued=${waiting}` +
          `${samples.length ? ` samples=${JSON.stringify(samples)}` : ''}\n`,
      );
    }
    process.stdout.write(`admonitions total=${total} queued=${queued}\n`);
    return;
  }

  if (command === 'status') {
    const state = readState();
    const commentMemory = loadCommentMemory();
    process.stdout.write(
      `${JSON.stringify({memory: state.memory, commentMemory: commentMemory.size, sections: state.sections}, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`${USAGE}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  // A bad `--locale=` is a user error: one line, no stack trace.
  const message = error instanceof LocaleError ? error.message : error.stack || error.message;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
