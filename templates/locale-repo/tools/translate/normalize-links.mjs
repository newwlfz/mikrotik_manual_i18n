#!/usr/bin/env node
/**
 * Final link pass over the Chinese overlays.
 *
 * Every producer that writes an overlay (`apply`, `derive`, `cli-tables`) copies
 * the English link form, and the CLI tables are rebuilt after `apply` from rows
 * harvested in an older release, so an absolute `/docs/...` link can reappear
 * after the rewrite already ran. This pass runs last and normalises every
 * overlay again:
 *
 *   - an internal document link becomes the relative `.md` form, because that is
 *     the only form Docusaurus retargets through its locale and release router;
 *   - a plain `<a href="/docs/...">label</a>` becomes that same Markdown link.
 *     A raw HTML href never reaches `resolveMarkdownLinks` (that remark plugin
 *     only visits `link`/`definition` nodes), so the browser keeps the literal
 *     release and locale the href spells - the English/current page. Anchors
 *     that must keep an attribute Markdown cannot carry, or a label with inline
 *     markup, stay HTML and are re-pointed to
 *     `/<locale><docsPrefix>/<slug>` by `rewriteLinks` (counted `htmlKept` here
 *     and `absoluteHtml` in `verify:links`);
 *   - a link whose text is the target page's English title is re-labelled with
 *     that page's Chinese title (see `rewriteLinks`);
 *   - a link whose target is not in this release's route table is left byte for
 *     byte and counted as `unresolved` (cross-release and CLI-only routes);
 *   - finally, the source heading ids are re-applied to every processed body.
 *     Relabelling a link that *is* a heading changes the text Docusaurus slugs,
 *     so the explicit `{#id}` an earlier pipeline stage wrote becomes stale.
 *     Re-stamping it here makes the fix independent of stage order.
 *
 * The pass is idempotent: a second run changes nothing.
 *
 *   node tools/translate/normalize-links.mjs [--check] [--section=docs-7.25]
 *                                            [--samples=10]
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {segmentSpans, fenceMask} from './lib/blocks.mjs';
import {
  rewriteLinks,
  extractLinks,
  parseTarget,
  routeTable,
  splitSuffix,
  pageTitles,
  relativeDocLink,
  normaliseSlug,
} from './lib/links.mjs';
import {
  anchorPattern,
  parseAnchorAttributes,
  anchorHref,
  isConvertible,
  hasMarkup,
  anchorLabel,
} from './lib/html-links.mjs';
import {currentVersion} from '../sync/lib/versions.mjs';
import {addHeadingAnchors} from './lib/anchors.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';

/**
 * Convert the inline anchors of one body and normalise its links.
 *
 * `context` is what `rewriteLinks` needs (`section`, `version`, `fromFile`,
 * `titleFor`) plus the route `table` this pass resolves anchors against.
 * Returns `{body, stats}` where stats counts `htmlConverted` (anchor became a
 * Markdown link), `htmlKept` (anchor needs its HTML) and `anchorPending`
 * (anchor this pass could not resolve at all).
 */
/**
 * Unwrap a relative `.md` link whose page does not exist.
 *
 * A reused translation can carry a link the current English block does not have
 * (the sentence was translated from an older capture). When the target exists in
 * neither the English tree nor the overlay, the link renders as a 404 and the
 * verifier reports `overlayMissing`. The label is real text, so it stays; only
 * the dead link syntax goes. A target that exists in the English tree but has no
 * overlay is a translation gap, not a dead link, and is left alone.
 */
export function unwrapDeadRelativeLinks(body, {section, fromFile}) {
  const overlayBase = path.join(REPO, section.overlay);
  const sourceBase = path.join(REPO, section.source);
  const dir = path.posix.dirname(fromFile);
  let changed = 0;
  const out = String(body).replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+\.mdx?)(#[^)]*)?\)/g, (whole, label, target) => {
    if (target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return whole;
    const resolved = path.posix.normalize(path.posix.join(dir, target)).replace(/^\.\//, '');
    if (resolved.startsWith('../')) return whole;
    if (
      fs.existsSync(path.join(overlayBase, resolved)) ||
      fs.existsSync(path.join(sourceBase, resolved))
    ) {
      return whole;
    }
    changed++;
    return label;
  });
  return {body: out, changed};
}

const SWEEP_MD_LINK = /(!?\[[^\]\n]*\]\()([^)\s]+)(\))/g;
const SWEEP_HREF = /(\bhref=")([^"]+)(")/g;

/**
 * Last-mile sweep for links that bypassed `rewriteLinks`.
 *
 * `apply`, `derive`, the CLI tables and the translation memory all write into
 * the same overlay, so a canonical 7.24 body reused in 7.25/current can bring
 * its `/docs/7.24/...` routes back after the earlier pass ran. This sweep runs
 * on every overlay body and re-bases two spellings against this release's route
 * table: a bare version root with a fragment (`/docs/<v>#x`, an in-page anchor
 * whose page slug was dropped) and a page route that is still prefixed with a
 * different release but exists in this one. Returns `{body, versionRootAnchors,
 * foreignVersionLinks, samples}`; a target absent from both tables stays byte
 * for byte and is counted as `unresolved` by the caller.
 */
export function repositionForeignVersionLinks(body, context) {
  const {table, version, fromFile} = context;
  const stats = {versionRootAnchors: 0, foreignVersionLinks: 0, samples: []};
  const pageSlug = normaliseSlug(fromFile || '');
  const allowed = new Set(
    context.crossVersionAllow instanceof Set
      ? [...context.crossVersionAllow]
      : Array.isArray(context.crossVersionAllow)
        ? context.crossVersionAllow
        : [],
  );

  const reposition = (url) => {
    const target = parseTarget(url);
    if (target.kind === 'docs-root') {
      if (!pageSlug) return url;
      const next = `${table.base}/${pageSlug}${target.fragment}`;
      stats.versionRootAnchors++;
      if (stats.samples.length < 64) stats.samples.push({before: url, after: next});
      return next;
    }
    if (
      target.kind !== 'docs' ||
      !target.version ||
      target.version === version ||
      target.official ||
      allowed.has(target.slug)
    ) {
      return url;
    }
    // Even when this release has no route for the slug, the version prefix is
    // not allowed to survive: re-base it on this release and let the verifier
    // count it as unresolved rather than leaving another release's URL behind.
    const entry = table.entries.get(target.slug);
    const next = `${table.base}/${(entry?.slug ?? target.slug)}${splitSuffix(url).suffix}`;
    stats.foreignVersionLinks++;
    if (stats.samples.length < 64) stats.samples.push({before: url, after: next});
    return next;
  };

  const out = [];
  for (const span of segmentSpans(String(body))) {
    if (span.part.kind === 'sep' || span.code) {
      out.push(span.part.value);
      continue;
    }
    let segment = span.part.value.replace(SWEEP_MD_LINK, (whole, open, url, close) => {
      if (open.startsWith('![')) return whole;
      const next = reposition(url);
      return next === url ? whole : `${open}${next}${close}`;
    });
    segment = segment.replace(SWEEP_HREF, (whole, open, url, close) => {
      const next = reposition(url);
      return next === url ? whole : `${open}${next}${close}`;
    });
    out.push(segment);
  }
  // A link whose label contains inline code is split across spans, so the
  // whole-link pattern above cannot see its URL. Work at the URL level on every
  // line outside a fenced code block to catch that spelling too.
  const joined = out.join('');
  const mask = fenceMask(joined);
  const sweptBody = joined
    .split('\n')
    .map((line, index) =>
      mask[index]
        ? line
        : line
            .replace(/(?<=\]\()(\/docs\/[^\s)]+)/g, (url) => reposition(url))
            .replace(/(?<=\bhref=")(\/docs\/[^"]+)/g, (url) => reposition(url)),
    )
    .join('\n');
  return {body: sweptBody, ...stats};
}

export function normaliseBody(body, context) {
  const {section, version, fromFile, table} = context;
  const stats = {
    htmlConverted: 0,
    htmlKept: 0,
    anchorPending: 0,
    versionRootAnchors: 0,
    foreignVersionLinks: 0,
    samples: [],
  };

  const convert = (whole, raw, inner) => {
    const attributes = parseAnchorAttributes(raw);
    const href = anchorHref(attributes);
    // Only internal routes: an external or official href is not this pass's.
    if (!href || !href.startsWith('/')) return whole;
    const {suffix} = splitSuffix(href);
    const target = parseTarget(href);
    if (target.kind === 'docs-root') {
      // An in-page anchor from the canonical capture. It may carry markup, so
      // leave the HTML here; `rewriteLinks` below re-points its href at this
      // page and the final sweep catches any spelling that still leaked.
      stats.versionRootAnchors++;
      return whole;
    }
    if (target.kind !== 'docs') return whole;
    // An explicit other release stays an absolute HTML link: a relative `.md`
    // link can only ever address the page's own release.
    if (target.version && target.version !== version) {
      stats.htmlKept++;
      return whole;
    }
    const entry = table.entries.get(target.slug);
    if (!entry?.file) {
      stats.anchorPending++;
      return whole;
    }
    if (version && !fs.existsSync(path.join(REPO, section.overlay, entry.file))) {
      // No Chinese page: a relative Markdown link would be broken in this build.
      stats.anchorPending++;
      return whole;
    }
    if (!isConvertible(attributes) || hasMarkup(inner)) {
      stats.htmlKept++;
      return whole;
    }
    const label = anchorLabel(inner);
    // A label a Markdown link cannot hold (brackets, or nothing visible) keeps
    // the anchor; `rewriteLinks` still gives it a locale-aware href.
    if (!label.trim() || /[[\]]/.test(label)) {
      stats.htmlKept++;
      return whole;
    }
    const markdown = `[${label}](${relativeDocLink(fromFile, entry.file)}${suffix})`;
    stats.htmlConverted++;
    if (stats.samples.length < 64) stats.samples.push({before: whole, after: markdown});
    return markdown;
  };

  // Fenced code and inline code are quoted examples, not links: converting an
  // `<a>` there would edit the documentation's own sample markup.
  const parts = [];
  for (const span of segmentSpans(String(body))) {
    if (span.part.kind === 'sep' || span.code) parts.push(span.part.value);
    else parts.push(span.part.value.replace(anchorPattern(), convert));
  }

  // Everything still in HTML form is re-pointed at this locale and release.
  const rewritten = rewriteLinks(parts.join(''), {...context, version});
  // Last mile: a reused TM/CLI-table body can reintroduce a canonical-version
  // route after the rewrite above. Re-base it against this release's table and
  // count each repair so a rerun after clearing overlays is verifiable.
  const swept = repositionForeignVersionLinks(rewritten, context);
  stats.versionRootAnchors += swept.versionRootAnchors;
  stats.foreignVersionLinks += swept.foreignVersionLinks;
  if (swept.samples.length) stats.samples.push(...swept.samples);
  return {body: swept.body, stats};
}

/**
 * Re-apply the English heading ids after `normaliseBody` has rewritten links.
 *
 * `rewriteLinks` relabels a link whose text is the target page's English title.
 * When that link is the whole heading (`## [Step by step installation](/docs/
 * 7.24/.../step-by-step-installation)` -> `## [逐步安裝](./x.md)`) the rendered
 * heading text - and therefore the id Docusaurus generates - changes. The
 * explicit `{#step-by-step-installation}` written by `addHeadingAnchors` earlier
 * in the chain is then gone, and `verify:anchors` reports a heading mismatch.
 * Running the same canonical pass at the end of this file repairs the ids no
 * matter which order the pipeline stages run in.
 *
 * `sourceBody` is the English source of this overlay page with front matter
 * stripped; the caller reads it from `path.join(REPO, section.source, rel)`,
 * which covers `docs/` and every `versioned_docs/version-*` section alike.
 * Idempotent: `addHeadingAnchors` only touches headings whose published id
 * differs from the source id, so a second run on a repaired body is a no-op.
 */
export function reapplyHeadingAnchors(body, sourceBody) {
  if (!sourceBody) return {body: String(body ?? ''), added: 0, corrected: 0, retargeted: 0};
  return addHeadingAnchors(body, sourceBody);
}

function option(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

/** Pick up to `count` samples spread over the list, so examples are not all one page. */
function pickEvenly(list, count) {
  if (list.length <= count) return list;
  const step = list.length / count;
  return Array.from({length: count}, (_, index) => list[Math.floor(index * step)]);
}

function main() {
  const CHECK = process.argv.includes('--check');
  const ONLY = option('section', '');
  const SAMPLE_COUNT = Number(option('samples', '0')) || 0;

  const sectionVersion = (section) => {
    const match = /version-(\d+\.\d+)/.exec(section.source);
    return match ? match[1] : currentVersion();
  };

  const sections = SECTIONS.filter((section) => /^docs/.test(section.name)).filter(
    (section) => !ONLY || section.name === ONLY,
  );

  const totals = {
    files: 0,
    rewritten: 0,
    htmlConverted: 0,
    htmlKept: 0,
    anchorPending: 0,
    versionRootAnchors: 0,
    foreignVersionLinks: 0,
    headingAnchorsAdded: 0,
    headingAnchorsCorrected: 0,
    headingAnchorsRetargeted: 0,
    absoluteMarkdown: 0,
    absoluteHtml: 0,
    deadRelative: 0,
    unresolved: 0,
    linkText: 0,
    linkTextPartial: 0,
    pdfAssets: 0,
    unresolvedAssets: 0,
    samples: [],
  };

  for (const section of sections) {
    const base = path.join(REPO, section.overlay);
    if (!fs.existsSync(base)) continue;
    const version = sectionVersion(section);
    const table = routeTable(version);
    const context = {version, section, table, titleFor: (entry) => pageTitles(section, entry)};
    const files = walkMarkdown(base);
    let changed = 0;
    const sectionStats = {
      htmlConverted: 0,
      htmlKept: 0,
      anchorPending: 0,
      versionRootAnchors: 0,
      foreignVersionLinks: 0,
      headingAnchorsAdded: 0,
      headingAnchorsCorrected: 0,
    };
    for (const file of files) {
      const rel = relative(base, file);
      totals.files++;
      const text = fs.readFileSync(file, 'utf8');
      const split = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/.exec(text);
      const prefix = split ? split[1] : '';
      const before = split ? split[2] : text;

      const counter = {linkText: 0, linkTextPartial: 0, pdfAssets: 0, unresolvedAssets: 0};
      const result = normaliseBody(before, {...context, fromFile: rel, stats: counter});
      for (const key of ['linkText', 'linkTextPartial', 'pdfAssets', 'unresolvedAssets']) totals[key] += counter[key];
      const dead = unwrapDeadRelativeLinks(result.body, {section, fromFile: rel});
      result.body = dead.body;
      if (dead.changed) {
        totals.deadRelative = (totals.deadRelative || 0) + dead.changed;
        if (totals.samples.length < 64) {
          totals.samples.push({
            before: `dead-relative ${section.name}/${rel}`,
            after: `${dead.changed} link(s) unwrapped`,
          });
        }
      }
      let body = result.body;

      // Link relabelling can change a heading's visible text, which changes the
      // id Docusaurus derives from it. Re-stamp the source ids last, just before
      // the overlay is written back, so the anchor fix survives this pass no
      // matter where normalize-links sits in the chain. This is a no-op on a
      // body whose explicit ids are already correct.
      const sourceFile = path.join(REPO, section.source, rel);
      const sourceBody = fs.existsSync(sourceFile)
        ? splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).body
        : null;
      const headingAnchors = reapplyHeadingAnchors(body, sourceBody);
      body = headingAnchors.body;
      totals.headingAnchorsAdded += headingAnchors.added;
      totals.headingAnchorsCorrected += headingAnchors.corrected;
      totals.headingAnchorsRetargeted += headingAnchors.retargeted;
      sectionStats.headingAnchorsAdded += headingAnchors.added;
      sectionStats.headingAnchorsCorrected += headingAnchors.corrected;

      for (const key of [
        'htmlConverted',
        'htmlKept',
        'anchorPending',
        'versionRootAnchors',
        'foreignVersionLinks',
      ]) {
        totals[key] += result.stats[key];
        sectionStats[key] += result.stats[key];
      }
      if (totals.samples.length < 64) totals.samples.push(...result.stats.samples);

      // What still points at an absolute route after the pass: either an anchor
      // that has to keep its HTML, or a link this release cannot resolve.
      for (const link of extractLinks(body)) {
        if (link.kind === 'image') continue;
        const {pathPart} = splitSuffix(link.url);
        if (!pathPart || !pathPart.startsWith('/')) continue;
        const target = parseTarget(link.url);
        if (target.kind !== 'docs' || target.official) continue;
        if (!table.entries.get(target.slug)) {
          totals.unresolved++;
          if (totals.samples.length < 64) {
            totals.samples.push({before: `unresolved ${section.name}/${rel}`, after: link.url});
          }
        } else if (link.kind === 'html') {
          totals.absoluteHtml++;
        } else {
          totals.absoluteMarkdown++;
        }
      }

      if (body !== before) {
        changed++;
        totals.rewritten++;
        if (!CHECK) fs.writeFileSync(file, `${prefix}${body}`);
      }
    }
    process.stdout.write(
      `${section.name}: files=${files.length} changed=${changed} htmlConverted=${sectionStats.htmlConverted} ` +
        `htmlKept=${sectionStats.htmlKept} anchorPending=${sectionStats.anchorPending} ` +
        `versionRootAnchors=${sectionStats.versionRootAnchors} ` +
        `foreignVersionLinks=${sectionStats.foreignVersionLinks} ` +
        `headingAnchorsAdded=${sectionStats.headingAnchorsAdded} ` +
        `headingAnchorsCorrected=${sectionStats.headingAnchorsCorrected}\n`,
    );
  }

  process.stdout.write(
    `normalize-links${CHECK ? ' (check)' : ''}: files=${totals.files} changed=${totals.rewritten} ` +
      `htmlConverted=${totals.htmlConverted} htmlKept=${totals.htmlKept} ` +
      `anchorPending=${totals.anchorPending} ` +
      `versionRootAnchors=${totals.versionRootAnchors} ` +
      `foreignVersionLinks=${totals.foreignVersionLinks} ` +
      `headingAnchorsAdded=${totals.headingAnchorsAdded} ` +
      `headingAnchorsCorrected=${totals.headingAnchorsCorrected} ` +
      `headingAnchorsRetargeted=${totals.headingAnchorsRetargeted} ` +
      `absoluteMarkdown=${totals.absoluteMarkdown} ` +
      `absoluteHtml=${totals.absoluteHtml} unresolved=${totals.unresolved} ` +
      `linkText=${totals.linkText} linkTextPartial=${totals.linkTextPartial} pdfAssets=${totals.pdfAssets} ` +
      `unresolvedAssets=${totals.unresolvedAssets}\n`,
  );

  if (SAMPLE_COUNT) {
    const anchors = totals.samples.filter((sample) => sample.before.startsWith('<a '));
    for (const sample of pickEvenly(anchors, SAMPLE_COUNT)) {
      process.stdout.write(`  before: ${sample.before}\n  after:  ${sample.after}\n`);
    }
  }

  if (CHECK && (totals.absoluteMarkdown || totals.htmlConverted)) process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry === fileURLToPath(import.meta.url)) main();
