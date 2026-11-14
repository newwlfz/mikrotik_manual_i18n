/**
 * Structural verification of a translation overlay.
 *
 * Everything checked here is a property that must survive translation: the same
 * files, the same fenced code (verbatim), the same images, the same front-matter
 * keys, and a document that still compiles as MDX. Prose that came back in
 * English is reported separately because the overlay is allowed to be partial.
 *
 * Fenced code has one exception, `code-verbatim-except-comments`: a line that
 * the classifier accepts as a line-leading comment may carry Chinese. The code
 * lines are still compared byte for byte, and a comment that changed without
 * becoming Chinese is reported as `commentDiff` rather than `fenceDiff`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  localeHasResources,
  sectionsFor,
  translatableLocales,
  walkMarkdown,
  relative,
} from './paths.mjs';
import YAML from 'yaml';
import {splitFrontMatter} from './frontmatter.mjs';
import {splitBlockSpans, hasFence, normalize, fenceMask, codeParagraphs} from './blocks.mjs';
import {splitAdmonitions, bodyParagraphs} from './admonitions.mjs';
import {languageText} from './prose.mjs';
import {
  fenceRoles,
  isCommentLanguage,
  normalizeLanguage,
  parseCommentLine,
} from './code-comments.mjs';
import {CJK} from './legacy.mjs';
import {images} from './apply.mjs';

const FENCE = /^\s*(```+|~~~+)/;
const ENGLISH = /\b(the|this|that|these|those|with|without|for|and|are|is|be|to|of|in|on|by|as|it|can|cannot|may|should|must|will|would|from|your|you|we|our|its)\b/i;
// Inline code is part of a sentence ("Example `connection-tracking-mode`
// configuration:"), so backticks and `=` must not disqualify an English line.
const PROSE = /^[A-Z][A-Za-z0-9 ,.'"()[\]/:;!?%+=`-]{15,}$/;
// A lead-in line ("Example `connection-tracking-mode` configuration:") is a
// sentence without function words, so the English-word test above misses it and
// the paragraph before a sample stayed English while the counter read zero.
const LEAD_IN = /^[A-Z][A-Za-z0-9 ,.'"()[\]/:;!?%+=`-]{10,}:$/;

export function fences(body) {
  const lines = body.split('\n');
  const mask = fenceMask(body);
  const out = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) {
      current = current || [];
      current.push(lines[i]);
    } else if (current) {
      out.push(current.join('\n'));
      current = null;
    }
  }
  if (current) out.push(current.join('\n'));
  return out;
}

/** Console transcripts stay English; see config/english-only-blocks.yml. */
function englishOnlyPrefixes() {
  const file = path.join(REPO, 'config/english-only-blocks.yml');
  if (!fs.existsSync(file)) return [];
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return (parsed.prefixes || []).map(String);
}

function frontMatterKeys(frontMatter) {
  return frontMatter
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):/.exec(line)?.[1])
    .filter(Boolean);
}

/** Prose blocks that are byte-identical to the English source and read English. */
export function untranslated(sourceBody, targetBody) {
  const {prose, admonitions} = untranslatedBlocks(sourceBody, targetBody);
  return [...prose, ...admonitions.map((item) => item.text)];
}

/**
 * Admonition blocks (`:::note … :::`) whose title or body still reads English.
 *
 * The prose rule above requires an uppercase sentence, which an admonition body
 * usually is not — its first word may be a command path or lowercase — so the
 * language test is a Chinese-character ratio plus the same English function-word
 * evidence, applied to the title and body only (the `:::` container is not text).
 */
export function untranslatedAdmonitions(sourceBody, targetBody) {
  return untranslatedBlocks(sourceBody, targetBody).admonitions;
}

/**
 * English units still inside a translated admonition.
 *
 * A whole-container test was blind to the failure the manual actually had: a
 * `:::note` with two paragraphs came back with the first paragraph in English
 * and the second in Chinese, so the container "carried Chinese" and every
 * counter stayed at zero. The unit is now the title and each body paragraph,
 * and a unit only counts when it is byte-identical (modulo whitespace) to the
 * English source's own unit: that is a paragraph the translation never touched,
 * not a legal statement the pipeline keeps in English on purpose.
 *
 * An admonition with no English counterpart keeps the old whole-container rule.
 */
/**
 * A body paragraph that is only a list of named products.
 *
 * The Hardware Guides open most chapters with `:::info This article covers`
 * followed by `- **CRS109-8G-1S-2HnD-IN**`. Those are model names, not prose:
 * translating them would rename the product, so they are excluded from the
 * English count instead of being queued forever.
 */
function isProductList(text) {
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every(
    (line) =>
      /^[-*+]\s+\*\*[^*]+\*\*(\s*\([^)]*\))?$/.test(line) ||
      /^[-*+]\s+\[[^\]]+\]\([^)]*\)(\s*\([^)]*\))?$/.test(line),
  );
}

function englishAdmonitionParts(parts, sourceParts, fenced = new Set()) {
  if (!sourceParts) {
    const inner = [parts.title, ...bodyParagraphs(parts.body).filter((text) => !fenced.has(text))]
      .filter(Boolean)
      .join('\n');
    return readsEnglish(inner) ? [inner] : [];
  }
  const translated = (text) => readsEnglish(text);
  // Compare the words, not the link labels: the overlay's labels are rewritten
  // to Chinese before `verify` ever sees the page, and requiring the raw bytes
  // to match the English source hid every paragraph whose only translated part
  // was a label (the `storage/ramdisk` warning).
  const words = (text) => normalize(languageText(text));
  const fromSource = (text) =>
    bodyParagraphs(sourceParts.body).some((candidate) => words(candidate) === words(text)) ||
    (sourceParts.title && words(sourceParts.title) === words(text));
  const out = [];
  if (parts.title && translated(parts.title) && fromSource(parts.title)) out.push(parts.title);
  for (const paragraph of bodyParagraphs(parts.body)) {
    // A command sample inside the warning is copied verbatim, so it always looks
    // "identical to the English source". Counting it would keep every fenced
    // admonition at one untranslated unit forever.
    if (fenced.has(paragraph)) continue;
    if (isProductList(paragraph)) continue;
    if (translated(paragraph) && fromSource(paragraph)) out.push(paragraph);
  }
  return out;
}

/** True when `text` carries no Chinese and still reads as English prose. */
function readsEnglish(text) {
  // Labels are translated separately (see `prose.mjs`): an English sentence
  // whose link labels are already Chinese is still English prose.
  if (CJK.test(languageText(text))) return false;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') return false;
  const words = flat.match(/[A-Za-z]{2,}/g) || [];
  return words.length >= 5 && ENGLISH.test(flat);
}

/**
 * Split the English-vs-overlay comparison into prose and admonition misses.
 *
 * Both lists are index-aligned with `splitBlocks`, which keeps an admonition as
 * one block even when its title and body are separated by a blank line.
 */
export function untranslatedBlocks(sourceBody, targetBody) {
  // `splitBlockSpans` carries the `code` verdict of the *containing body*, so a
  // fragment that starts inside a fence stays code while an admonition that
  // merely shows a command is prose. Splitting on the block text alone cannot
  // tell those apart.
  const source = splitBlockSpans(sourceBody);
  const target = splitBlockSpans(targetBody);
  const prose = [];
  const admonitions = [];
  const fenced = {total: 0, untranslated: 0};
  for (let i = 0; i < Math.min(source.length, target.length); i++) {
    const span = target[i];
    const block = span.text;
    if (span.code) continue;
    const parts = splitAdmonitions(block);
    if (parts && parts.tail !== '') {
      // A warning that shows a command keeps that command byte for byte; only
      // its title and prose paragraphs are language. The counters are split so
      // "the fenced warnings" have a number of their own.
      const fencedParagraphs = codeParagraphs(parts.body);
      const fencedBlock = hasFence(block);
      if (fencedBlock) fenced.total += 1;
      const english = englishAdmonitionParts(
        parts,
        splitAdmonitions(source[i]?.text ?? ''),
        fencedParagraphs,
      );
      if (english.length) {
        admonitions.push({
          block: block.trim(),
          text: english[0].trim().replace(/\s+/g, ' ').slice(0, 80),
        });
        if (fencedBlock) fenced.untranslated += 1;
      }
      continue;
    }
    // A block whose only translated part is a link label is not translated:
    // compare and language-test the words outside the labels.
    const words = languageText(block);
    const sourceWords = languageText(source[i].text);
    if (CJK.test(words) || normalize(words) !== normalize(sourceWords)) continue;
    const head = words.trim();
    if (!head || /^[<|#`!]/.test(head)) continue;
    const tokens = head.match(/[A-Za-z]{2,}/g) || [];
    const flat = head.replace(/\s+/g, ' ');
    const sentence = tokens.length >= 5 && ENGLISH.test(head) && PROSE.test(flat);
    const leadIn = tokens.length >= 3 && LEAD_IN.test(flat);
    if (sentence || leadIn) {
      prose.push(block.trim().slice(0, 80));
    }
  }
  return {prose, admonitions, fenced};
}

/**
 * Compare one fence block (fence lines included).
 *
 * The source decides which lines are comment slots. A comment slot may hold
 * Chinese; if it still holds the English text it is counted as untranslated;
 * if it changed without becoming Chinese, that is a real defect.
 */
export function compareFence(sourceFence, targetFence) {
  const sourceLines = sourceFence.split('\n');
  const targetLines = targetFence.split('\n');
  const out = {code: [], commentDiff: [], untranslated: []};
  if (sourceLines.length !== targetLines.length) {
    out.code.push(`lines ${sourceLines.length}->${targetLines.length}`);
    return out;
  }
  const closer = /^\s*[`~]{3,}\s*$/.test(sourceLines[sourceLines.length - 1] || '');
  const inner = sourceLines.slice(1, sourceLines.length - (closer ? 1 : 0));
  // Only a fence in a comment language can carry a translated comment; every
  // other fence is compared line by line as code.
  const opener = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:`{3,}|~{3,})\s*([^\s]*)/.exec(sourceLines[0] || '');
  const language = normalizeLanguage(opener?.[1]);
  const roles = isCommentLanguage(language)
    ? fenceRoles(inner)
    : inner.map(() => ({role: 'code'}));
  for (let i = 0; i < sourceLines.length; i++) {
    const role = i > 0 ? roles[i - 1] : null;
    const target = targetLines[i];
    if (!role || role.role !== 'comment') {
      if (target !== sourceLines[i]) {
        out.code.push(`line ${i + 1} changed: ${JSON.stringify(sourceLines[i].slice(0, 40))}`);
      }
      continue;
    }
    const parsed = parseCommentLine(target);
    if (!parsed) {
      out.commentDiff.push(`line ${i + 1} is no longer a comment`);
      continue;
    }
    if (parsed.hashes !== role.parsed.hashes || parsed.space !== role.parsed.space) {
      out.commentDiff.push(`line ${i + 1} comment shape changed`);
    }
    if (CJK.test(parsed.text)) continue;
    if (parsed.text.trim() === role.parsed.text.trim()) {
      out.untranslated.push(role.parsed.text.trim().slice(0, 60));
    } else {
      out.commentDiff.push(`line ${i + 1} changed but is not Chinese`);
    }
  }
  return out;
}

/**
 * Docusaurus never hands raw markdown to MDX. Its loader preprocesses the file
 * first (`@docusaurus/mdx-loader/lib/preprocessor.js`): `unwrapMdxCodeBlocks`,
 * then `escapeMarkdownHeadingIds` whenever `mdx1Compat.headingIds` is on, which
 * is the v3 default. That second step rewrites the classic `### Title {#id}`
 * extension to `### Title \{#id}`, and the `remark/headings` plugin turns the
 * escaped text back into a heading id. Compiling without it makes every explicit
 * heading id look like JSX, which is exactly the "Could not parse expression
 * with acorn" flood.
 *
 * Mirroring the preprocessor keeps this check faithful to the real build while
 * still failing on genuine MDX syntax errors: only `{#` in heading lines moves,
 * and the text is only used for the compile, never for the other checks.
 */
function escapeHeadingIds(text) {
  // Same expression as @docusaurus/utils: one to six line-leading `#` markers
  // open a heading, and no seventh `#` may follow them.
  return text.replace(/(?:^|\n)#{1,6}(?!#).*/g, (line) =>
    line
      .replace('{#', '\\{#')
      // An id that is already escaped must not be escaped twice.
      .replace('\\\\{#', '\\{#'),
  );
}

let mdxPreprocessPromise;
function mdxPreprocess() {
  mdxPreprocessPromise ??= import('@docusaurus/utils')
    .then((utils) =>
      typeof utils.escapeMarkdownHeadingIds === 'function' && typeof utils.unwrapMdxCodeBlocks === 'function'
        ? (text) => utils.escapeMarkdownHeadingIds(utils.unwrapMdxCodeBlocks(text))
        : escapeHeadingIds,
    )
    // The fallback keeps the check working if the internal package is ever
    // reshuffled; the rewrite above is the part that matters for parsing.
    .catch(() => escapeHeadingIds);
  return mdxPreprocessPromise;
}

/**
 * Compile one document the way the Docusaurus build parses it: preprocess, then
 * MDX. Throws on real MDX errors. `verify` and the negative self-test share it,
 * so they cannot drift apart.
 */
export async function compileMdxDocument(text) {
  const {compileSync} = await import('@mdx-js/mdx');
  const preprocess = await mdxPreprocess();
  compileSync(preprocess(text), {format: 'mdx'});
}

/**
 * Configured targets that already have a resource on disk (`i18n/<locale>/`,
 * glossary, patches or TM). `--all-locales` uses this so a locale that is only
 * a name so far is not reported as 1,484 missing overlays.
 */
export function resourceLocales() {
  return translatableLocales().filter((locale) => localeHasResources(locale));
}

/** A section record for a locale with no resources: nothing exists to compare. */
function emptyStat() {
  return {
    sources: 0,
    overlays: 0,
    missing: [],
    extra: [],
    fenceDiff: [],
    commentDiff: [],
    commentUntranslated: 0,
    imageDiff: [],
    frontMatterDiff: [],
    untranslated: 0,
    untranslatedAdmonitions: 0,
    fencedAdmonitions: {total: 0, untranslated: 0},
    emptyOverlays: [],
    intentionalEnglish: 0,
  };
}

export async function verify({compile = true, locale = DEFAULT_TARGET_LOCALE} = {}) {
  const report = {
    locale,
    sections: {},
    problems: [],
    mdxErrors: [],
    untranslatedSamples: [],
    commentSamples: [],
    admonitionSamples: [],
  };
  let totalFences = 0;

  const sections = sectionsFor(locale);
  // A locale with no resource is only a naming convention: every overlay is
  // absent, which is the expected state, not 1,484 missing pages. Report zeroes
  // so `verify --locale=<tag>` remains a valid read-only probe.
  const noResources = !localeHasResources(locale);
  report.noResources = noResources;

  const englishOnly = englishOnlyPrefixes();
  for (const section of sections) {
    if (noResources) {
      report.sections[section.name] = emptyStat();
      continue;
    }
    let intentionalEnglish = 0;
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    const sources = walkMarkdown(sourceBase);
    const overlays = new Map(walkMarkdown(overlayBase).map((file) => [relative(overlayBase, file), file]));
    const stat = {sources: sources.length, overlays: overlays.size, missing: [], extra: [], fenceDiff: [], commentDiff: [], commentUntranslated: 0, imageDiff: [], frontMatterDiff: [], untranslated: 0, untranslatedAdmonitions: 0, fencedAdmonitions: {total: 0, untranslated: 0}, emptyOverlays: []};

    for (const sourcePath of sources) {
      const rel = relative(sourceBase, sourcePath);
      const overlayPath = overlays.get(rel);
      const source = fs.readFileSync(sourcePath, 'utf8');
      const {frontMatter: sourceFm, body: sourceBody} = splitFrontMatter(source);
      if (!overlayPath) {
        stat.missing.push(rel);
        continue;
      }
      overlays.delete(rel);
      const target = fs.readFileSync(overlayPath, 'utf8');
      const {frontMatter: targetFm, body: targetBody} = splitFrontMatter(target);

      const sourceFences = fences(sourceBody);
      const targetFences = fences(targetBody);
      totalFences += sourceFences.length;
      if (sourceFences.length !== targetFences.length) {
        stat.fenceDiff.push(`${rel} ${sourceFences.length}->${targetFences.length}`);
      } else {
        for (let index = 0; index < sourceFences.length; index++) {
          const comparison = compareFence(sourceFences[index], targetFences[index]);
          if (comparison.code.length) {
            stat.fenceDiff.push(`${rel} fence#${index + 1} ${comparison.code[0]}`);
          }
          for (const item of comparison.commentDiff) {
            stat.commentDiff.push(`${rel} fence#${index + 1} ${item}`);
          }
          stat.commentUntranslated += comparison.untranslated.length;
          if (comparison.untranslated.length && report.commentSamples.length < 10) {
            report.commentSamples.push(`${rel}: ${comparison.untranslated[0]}`);
          }
        }
      }

      // `/img/<hash>` is the content-addressed form of `static/img/<hash>`; the
      // English page and its overlay must compare as the same file even when one
      // side still points at a page-relative `./img/x`.
      const resolve = (base, url) =>
        /^(?:[a-z]+:|\/|#)/i.test(url)
          ? url.startsWith('/img/')
            ? path.join(REPO, 'static', url)
            : url
          : path.resolve(base, url);
      const sourceImages = images(sourceBody).map((url) =>
        resolve(path.dirname(sourcePath), url),
      );
      const targetImages = images(targetBody).map((url) =>
        resolve(path.dirname(overlayPath), url),
      );
      if (sourceImages.join('|') !== targetImages.join('|')) {
        stat.imageDiff.push(`${rel} ${sourceImages.length}->${targetImages.length}`);
      }

      // A page whose English has a body but whose overlay is empty renders as a
      // blank page, and every other counter here stays at zero because there is
      // nothing to compare block by block.
      if (sourceBody.trim() && !targetBody.trim()) stat.emptyOverlays.push(rel);
      const missingKeys = frontMatterKeys(sourceFm).filter((key) => !frontMatterKeys(targetFm).includes(key));
      if (missingKeys.length) stat.frontMatterDiff.push(`${rel} missing:${missingKeys.join(',')}`);

      const {prose, admonitions, fenced} = untranslatedBlocks(sourceBody, targetBody);
      stat.fencedAdmonitions.total += fenced.total;
      stat.fencedAdmonitions.untranslated += fenced.untranslated;
      const kept = (text) => {
        if (englishOnly.some((prefix) => text.startsWith(prefix))) {
          intentionalEnglish++;
          return false;
        }
        return true;
      };
      const misses = prose.filter(kept);
      const admonitionMisses = admonitions.filter((item) => kept(item.text));
      stat.untranslated += misses.length;
      stat.untranslatedAdmonitions += admonitionMisses.length;
      if (misses.length && report.untranslatedSamples.length < 10) {
        report.untranslatedSamples.push(`${rel}: ${misses[0]}`);
      }
      if (admonitionMisses.length && report.admonitionSamples.length < 10) {
        report.admonitionSamples.push(`${rel}: ${admonitionMisses[0].text}`);
      }

      if (compile) {
        // Compare against the source: a page the English build itself cannot
        // compile in isolation (Docusaurus adds plugins) is not a translation bug.
        let sourceOk = true;
        try {
          await compileMdxDocument(source);
        } catch {
          sourceOk = false;
        }
        if (sourceOk) {
          try {
            await compileMdxDocument(target);
          } catch (error) {
            report.mdxErrors.push(`${rel}: ${String(error.message).split('\n')[0]}`);
          }
        }
      }
    }

    stat.extra = [...overlays.keys()];
    stat.intentionalEnglish = intentionalEnglish;
    report.sections[section.name] = stat;
  }

  report.totalFences = totalFences;
  report.summary = Object.fromEntries(
    Object.entries(report.sections).map(([name, stat]) => [
      name,
      {
        sources: stat.sources,
        overlays: stat.overlays,
        missing: stat.missing.length,
        extra: stat.extra.length,
        fenceDiff: stat.fenceDiff.length,
        commentDiff: stat.commentDiff.length,
        commentUntranslated: stat.commentUntranslated,
        imageDiff: stat.imageDiff.length,
        frontMatterDiff: stat.frontMatterDiff.length,
        emptyOverlays: stat.emptyOverlays.length,
        untranslatedBlocks: stat.untranslated,
        untranslatedAdmonitions: stat.untranslatedAdmonitions,
        fencedAdmonitions: stat.fencedAdmonitions.total,
        fencedAdmonitionsEnglish: stat.fencedAdmonitions.untranslated,
        intentionalEnglish: stat.intentionalEnglish,
      },
    ]),
  );
  // A single aggregate counter so a CI step can assert on admonitions without
  // reading every section; it is non-zero whenever any warning body is English.
  report.totals = {
    untranslatedAdmonitions: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.untranslatedAdmonitions,
      0,
    ),
    // Fenced warnings are reported separately: they used to be invisible (the
    // whole block was classified as code), so a run could say "0 untranslated"
    // while every warning with a command sample was still English.
    fencedAdmonitions: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.fencedAdmonitions.total,
      0,
    ),
    fencedAdmonitionsEnglish: Object.values(report.sections).reduce(
      (sum, stat) => sum + stat.fencedAdmonitions.untranslated,
      0,
    ),
  };
  return report;
}
