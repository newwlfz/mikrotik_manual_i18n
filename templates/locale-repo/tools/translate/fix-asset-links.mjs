#!/usr/bin/env node
/**
 * Point PDF links at the cached file the mirror actually ships, and report the
 * links that still leave the mirror.
 *
 * The export links `https://manual.mikrotik.com/assets/files/<name>.pdf`, but
 * `static/assets/files` stores the same file content-addressed
 * (`<stem>-<sha>.pdf`), and `static/` is served from the site root. A cached
 * attachment therefore belongs to the mirror as `/assets/files/<name>`, which
 * keeps the reader on the mirrored site instead of sending them to the official
 * one. A rebuild restores the English URL, so this pass runs at the end of the
 * translate chain; a link whose file was never downloaded keeps the official
 * URL and is counted as `unresolved`.
 *
 * The link is written as a raw HTML anchor rather than a Markdown link, because
 * `mdx-loader`'s `transformLinks` turns a Markdown link to a repository file
 * into a `require()` and the `otherAssets` loader then appends a second content
 * hash to the already hashed name (`<stem>-<sha>-<sha>.pdf`, counted here as
 * `anchored`). See `lib/pdf-links.mjs`.
 *
 * The same run reports every `manual.mikrotik.com` link the overlays still
 * carry, grouped by section and by what the link points at (a docs route, an
 * asset, something else), so the share that leaves the mirror is a number
 * instead of an impression. It is read from the files as they are on disk, so
 * `--check` shows the work remaining. Reporting only: those links are not
 * rewritten here.
 *
 *   node tools/translate/fix-asset-links.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {extractLinks, resolvePdfAsset, splitSuffix} from './lib/links.mjs';
import {anchorPdfLinks, countMarkdownPdfLinks} from './lib/pdf-links.mjs';
import {splitFrontMatter} from './lib/frontmatter.mjs';

/**
 * Any link target on the official site.
 *
 * The body is scanned with `extractLinks`, so a bare URL in prose and the
 * front matter's own `source:` provenance URL are not links and are not
 * counted; only what a reader can click is.
 */
const OFFICIAL_HOST = /^https?:\/\/(?:www\.)?manual\.mikrotik\.com(?=[/?#]|$)/i;
/** The same host inside a body, for the rewrite itself. */
const OFFICIAL_LINK = /https?:\/\/(?:www\.)?manual\.mikrotik\.com[^\s)"'<>]*/g;
const OFFICIAL_ROUTE = /^\/docs(?:\/\d+(?:\.\d+)*)?(?:\/|$)/;
const OFFICIAL_ASSET = /^\/assets\//;

/** What one official-site link points at, for the report. */
function classifyOfficial(url) {
  const pathname = url.replace(/^https?:\/\/(?:www\.)?manual\.mikrotik\.com/i, '').split(/[?#]/)[0] || '/';
  if (pathname.endsWith('.pdf') || OFFICIAL_ASSET.test(pathname)) return 'asset';
  if (OFFICIAL_ROUTE.test(pathname)) return 'docs';
  return 'other';
}

export function main() {
  const CHECK = process.argv.includes('--check');
  const stats = {files: 0, changed: 0, links: 0, anchored: 0, unresolved: 0};
  const samples = [];
  /** `${section}` -> `{docs, asset, other}` counts of links still official. */
  const officialBySection = {};
  const officialTotals = {docs: 0, asset: 0, other: 0};
  const assetIssues = [];

  for (const section of SECTIONS) {
    const base = path.join(REPO, section.overlay);
    if (!fs.existsSync(base)) continue;
    const sectionOfficial = (officialBySection[section.name] = {docs: 0, asset: 0, other: 0});
    for (const file of walkMarkdown(base)) {
      stats.files++;
      const rel = relative(base, file);
      const text = fs.readFileSync(file, 'utf8');
      let count = 0;
      const resolved = text.replace(OFFICIAL_LINK, (whole) => {
        const pdf = resolvePdfAsset(whole);
        if (!pdf) return whole;
        if (pdf.missing) {
          stats.unresolved++;
          if (assetIssues.length < 20) assetIssues.push(`${section.name}/${rel}: ${pdf.missing}`);
          return whole;
        }
        count++;
        return pdf.path;
      });
      // A Markdown link to the attachment is re-hashed by `mdx-loader`
      // (`<stem>-<sha>-<sha>.pdf`); the anchor form is served unchanged from
      // `static/`. A retranslated overlay copies the English form, so the
      // conversion runs here too, not just in `sync-pdfs`.
      const next = anchorPdfLinks(resolved);
      if (next !== resolved) {
        stats.anchored += countMarkdownPdfLinks(resolved) - countMarkdownPdfLinks(next);
      }
      // The inventory describes the overlays as they are on disk, so a `--check`
      // run reports what still has to change, not what it just changed.
      for (const link of extractLinks(splitFrontMatter(text).body)) {
        if (link.kind === 'image' || !OFFICIAL_HOST.test(link.url)) continue;
        const kind = classifyOfficial(link.url);
        sectionOfficial[kind]++;
        officialTotals[kind]++;
      }
      if (next === text) continue;
      stats.changed++;
      stats.links += count;
      if (samples.length < 5) samples.push(relative(base, file));
      if (!CHECK) fs.writeFileSync(file, next);
    }
  }

  const report = {
    mode: CHECK ? 'check' : 'apply',
    ...stats,
    samples,
    official: {...officialTotals, bySection: officialBySection},
    unresolvedAssets: assetIssues,
  };
  console.log(JSON.stringify(report, null, 1));
  if (CHECK && stats.changed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
