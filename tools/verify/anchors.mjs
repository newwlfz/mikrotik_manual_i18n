#!/usr/bin/env node
/**
 * Anchor checks for the Chinese overlays.
 *
 * A translated heading used to get a translated id (`## 配置示例` -> `#配置示例`),
 * so every link that pointed at the English anchor (`#config-example`) died -
 * silently, because a bad fragment is not a broken link Docusaurus reports.
 * `tools/translate/lib/anchors.mjs` now writes the English id onto the Chinese
 * heading (`## 配置示例 {#config-example}`); this verifier asserts that the ids
 * a page publishes really exist.
 *
 * Target resolution:
 *
 *   - a bare `#anchor` must exist in the same page;
 *   - a relative `../x.md#anchor` names the file directly;
 *   - `/docs/<slug>#anchor` is looked up in the route table of the page's own
 *     release, or of the release the URL names.
 *
 * An anchor may also be published by hand (`<span id="x">`), so raw HTML ids
 * count as well.
 *
 * The CLI Reference pages are built from `<ArgTableRow arg="...">`, and that
 * component renders `<td id={arg}>`. Those ids only exist in the rendered page,
 * so a heading-only scan reports every `#mlag-peer-port` / `#output.network`
 * link as missing even though it works. `argIdsOf` collects them from the page
 * source (the id is the literal `arg` value: the component does not slugify)
 * and a miss against the heading ids is retried against that set. The count is
 * reported separately as `missingFromArgTable` so "not really missing" never
 * hides a real dead anchor.
 */

import fs from 'node:fs';
import path from 'node:path';

import {SECTIONS, REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {headingIds} from '../translate/lib/anchors.mjs';
import {
  extractLinks,
  normaliseSlug,
  parseTarget,
  routeTable,
  sectionVersion,
  splitSuffix,
} from '../translate/lib/links.mjs';
import {currentVersion} from '../sync/lib/versions.mjs';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** Per-kind sample count; a full list is one env var away. */
const SAMPLE_LIMIT = Number(process.env.VERIFY_ANCHORS_SAMPLES || 3);

const cache = new Map();

/**
 * Does another page (normally the English source) also fail to publish `anchor`?
 *
 * A dead anchor that the English page carries too is inherited from upstream -
 * the mirror did not drop it, and calling it a regression would make the check
 * cry wolf. Only an anchor that exists upstream but is missing here (or in the
 * overlay that replaced the upstream page) counts as `missing`.
 */
function lacksAnchor(file, anchor) {
  if (!fs.existsSync(file)) return false;
  const info = idsOf(file);
  return !info.ids.has(anchor) && !info.argIds.has(anchor);
}

/**
 * Argument ids published by `<ArgTableRow arg="...">`.
 *
 * The tag may span several lines (`typ` can wrap), so the scan cannot be line
 * oriented. The rendered id is the raw `arg` string - `<td id={arg}>` in
 * `src/components/ArgTableRow/index.tsx` - so no slugging is applied here.
 */
function argIdsOf(body) {
  const ids = new Set();
  for (const match of body.matchAll(/<ArgTableRow\b[^>]*?\barg="([^"]*)"/g)) {
    const value = match[1];
    if (value) ids.add(value);
  }
  return ids;
}

/** Ids one file publishes: heading ids, hand-written HTML ids, argument ids. */
function idsOf(file) {
  if (cache.has(file)) return cache.get(file);
  const ids = new Set();
  const argIds = new Set();
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    for (const id of headingIds(body)) ids.add(id);
    for (const match of body.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
    for (const id of argIdsOf(body)) argIds.add(id);
  }
  const entry = {ids, argIds};
  cache.set(file, entry);
  return entry;
}

/** The same page in the Chinese overlay, else its English source. */
function pageFiles(section, version, file) {
  const overlay = path.join(REPO, section.overlay, file);
  const source = path.join(REPO, section.source, file);
  return fs.existsSync(overlay) ? overlay : source;
}

const failures = [];
const details = {};

for (const section of SECTIONS) {
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  const version = sectionVersion(section.name);
  const counts = {
    files: 0,
    anchors: 0,
    samePage: 0,
    crossPage: 0,
    missing: 0,
    upstreamMissing: 0,
    missingFromArgTable: 0,
    unresolved: 0,
  };
  const samples = new Map();
  const note = (kind, where, anchor) => {
    const list = samples.get(kind) || [];
    if (list.length < SAMPLE_LIMIT) list.push(`${where} -> #${anchor}`);
    samples.set(kind, list);
  };

  for (const file of walkMarkdown(overlayBase)) {
    counts.files++;
    const rel = relative(overlayBase, file);
    const text = fs.readFileSync(file, 'utf8');
    const own = idsOf(file);

    for (const link of extractLinks(text)) {
      if (link.kind === 'image') continue;
      const {pathPart, suffix} = splitSuffix(link.url);
      if (!suffix.includes('#')) continue;
      const anchor = decodeURIComponent(suffix.slice(suffix.indexOf('#') + 1));
      if (!anchor) continue;
      if (SCHEME.test(pathPart) && !pathPart.startsWith('/')) continue;
      counts.anchors++;

      if (!pathPart || pathPart === rel) {
        counts.samePage++;
        if (!own.ids.has(anchor)) {
          if (own.argIds.has(anchor)) {
            counts.missingFromArgTable++;
          } else if (lacksAnchor(path.join(REPO, section.source, rel), anchor)) {
            counts.upstreamMissing++;
            note('upstream-missing-anchor', `${section.name}/${rel}`, anchor);
          } else {
            counts.missing++;
            note('missing-anchor', `${section.name}/${rel}`, anchor);
          }
        }
        continue;
      }

      let targetPage = null;
      let sourcePage = null;
      if (!pathPart.startsWith('/')) {
        const resolved = path.posix
          .normalize(path.posix.join(path.posix.dirname(rel), pathPart))
          .replace(/^\.\//, '');
        if (resolved.startsWith('../')) {
          counts.unresolved++;
          continue;
        }
        targetPage = idsOf(pageFiles(section, version, resolved));
        sourcePage = path.join(REPO, section.source, resolved);
        counts.crossPage++;
      } else {
        const target = parseTarget(pathPart);
        if (target.kind !== 'docs') continue;
        // A section that is not versioned links into the current release.
        const table = routeTable(target.version || version || currentVersion());
        const entry = table.entries.get(target.slug);
        if (!entry?.file) {
          counts.unresolved++;
          note('unresolved-target', `${section.name}/${rel}`, target.slug);
          continue;
        }
        // A cross-release link resolves inside the release it names.
        const named = target.version && target.version !== version;
        const targetSection = named
          ? SECTIONS.find((item) => item.name === `docs-${target.version}`) || section
          : section;
        targetPage = idsOf(pageFiles(targetSection, named ? target.version : version, entry.file));
        sourcePage = path.join(REPO, targetSection.source, entry.file || '');
        counts.crossPage++;
      }

      if (!targetPage || (targetPage.ids.size === 0 && targetPage.argIds.size === 0)) {
        counts.unresolved++;
        continue;
      }
      if (!targetPage.ids.has(anchor)) {
        if (targetPage.argIds.has(anchor)) {
          counts.missingFromArgTable++;
        } else if (lacksAnchor(sourcePage, anchor)) {
          counts.upstreamMissing++;
          note('upstream-missing-anchor', `${section.name}/${rel}`, anchor);
        } else {
          counts.missing++;
          note('missing-anchor', `${section.name}/${rel}`, anchor);
        }
      }
    }
  }

  details[section.name] = counts;
  for (const [kind, list] of samples) {
    for (const sample of list) console.log(`  ${kind}: ${sample}`);
  }
  if (counts.missing) {
    failures.push(`${section.name}: ${counts.missing}/${counts.anchors} anchor(s) missing (${JSON.stringify(counts)})`);
  }
}

const totals = {
  anchors: 0,
  samePage: 0,
  crossPage: 0,
  missing: 0,
  upstreamMissing: 0,
  missingFromArgTable: 0,
  unresolved: 0,
};
for (const [name, counts] of Object.entries(details)) {
  totals.anchors += counts.anchors;
  totals.samePage += counts.samePage;
  totals.crossPage += counts.crossPage;
  totals.missing += counts.missing;
  totals.upstreamMissing += counts.upstreamMissing || 0;
  totals.missingFromArgTable += counts.missingFromArgTable || 0;
  totals.unresolved += counts.unresolved;
  console.log(`  ${counts.missing ? 'FAIL' : 'ok  '} ${name}: ${JSON.stringify(counts)}`);
}
console.log(`TOTAL ${JSON.stringify(totals)}`);
if (failures.length) {
  for (const line of failures) console.log(`FAIL ${line}`);
  process.exitCode = 1;
}
