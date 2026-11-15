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
 *     byte and counted as `unresolved` (cross-release and CLI-only routes).
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
import {segmentSpans} from './lib/blocks.mjs';
import {
  rewriteLinks,
  extractLinks,
  parseTarget,
  routeTable,
  splitSuffix,
  pageTitles,
  relativeDocLink,
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

export function normaliseBody(body, context) {
  const {section, version, fromFile, table} = context;
  const stats = {htmlConverted: 0, htmlKept: 0, anchorPending: 0, samples: []};

  const convert = (whole, raw, inner) => {
    const attributes = parseAnchorAttributes(raw);
    const href = anchorHref(attributes);
    // Only internal routes: an external or official href is not this pass's.
    if (!href || !href.startsWith('/')) return whole;
    const {pathPart, suffix} = splitSuffix(href);
    const target = parseTarget(pathPart);
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
  return {body: rewritten, stats};
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
    const sectionStats = {htmlConverted: 0, htmlKept: 0, anchorPending: 0};
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
      const body = result.body;
      for (const key of ['htmlConverted', 'htmlKept', 'anchorPending']) {
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
        const target = parseTarget(pathPart);
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
        `htmlKept=${sectionStats.htmlKept} anchorPending=${sectionStats.anchorPending}\n`,
    );
  }

  process.stdout.write(
    `normalize-links${CHECK ? ' (check)' : ''}: files=${totals.files} changed=${totals.rewritten} ` +
      `htmlConverted=${totals.htmlConverted} htmlKept=${totals.htmlKept} ` +
      `anchorPending=${totals.anchorPending} absoluteMarkdown=${totals.absoluteMarkdown} ` +
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
