#!/usr/bin/env node
/**
 * Link and title checks for the Chinese overlays.
 *
 * The overlays used to carry three kinds of link defect that nothing reported:
 *
 *   1. an internal link written as an absolute path with the capture's `.md`
 *      suffix ("[/docs/x.md](/docs/x.md)"): that names a file, not a route, and
 *      Docusaurus ships it as a literal path;
 *   2. a bare `/docs/<slug>` URL on an archived page, which silently points at
 *      the current release in the default locale;
 *   3. a link to the official site for a page the mirror already carries.
 *
 * The rule that replaces them: an internal document link inside a docs section
 * is a *relative* `.md` link, because that is the only form Docusaurus retargets
 * through its route and locale resolver (see `tools/translate/lib/links.mjs`).
 * An absolute link stays acceptable only where a relative one cannot work - the
 * target has no Chinese overlay, the target is in another content plugin, or it
 * does not exist in this release - and those are counted separately so the
 * number can be watched going down.
 *
 * The title check rides along because it is the same class of bug, but a page
 * `title` that is still English is not one by itself: the title is not a link
 * text. The defect is a link whose visible text names the target page in
 * English while that page already has a Chinese title - the reader sees an
 * English label pointing at a Chinese page. Those are `failedTitle`. "Names the
 * page" is `classifyLinkText`: the exact English title, or a text similar enough
 * to it (`link_text_similarity` in `config/translation.yml`, word-set overlap)
 * to be the same words - "Quick start" pointing at "Quick Start guide" is the
 * same defect as an exact copy. An English page title with nothing to click, a
 * lowercase ASCII identifier (`tmpfs`, `poe-out`) and a glossary term are
 * counted as `toleratedTitle`.
 *
 * A raw `<a href="/docs/...">` is the other form of the same bypass: MDX renders
 * it verbatim and the Markdown-link resolver never sees it. An anchor that
 * resolves in this release must therefore carry its locale
 * (`/<locale><docsPrefix>/<slug>`), which is `absoluteHtml`; an anchor that
 * still spells a bare `/docs/...` route is `htmlNoLocale`.
 */

import fs from 'node:fs';
import path from 'node:path';

import {SECTIONS, REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {
  classifyLinkText,
  extractLinks,
  normaliseSlug,
  parseTarget,
  routeTable,
  sectionLocale,
  sectionVersion,
  splitSuffix,
} from '../translate/lib/links.mjs';
import {currentVersion} from '../sync/lib/versions.mjs';

const CJK = /[\u4e00-\u9fff]/;
/** `pathname://`, `mailto:`, `tel:`, ... are explicit "do not touch" markers. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** A relative link to a file is an asset, not a route. */
const ASSET = /\.(?:png|jpe?g|webp|gif|svg|pdf|txt|zip|gz|rsc|json|csv|npk|pcap|bin|mp4|webm|iso|img)$/i;

const failures = [];
const details = {};
/** Per-section sample lists, keyed by kind; used for the summary at the end. */
const sectionSamples = new Map();

/** Per-kind sample count; a full list is one env var away. */
const SAMPLE_LIMIT = Number(process.env.VERIFY_LINKS_SAMPLES || 3);

/**
 * Does the English source page carry a link to the same dead route?
 *
 * An absolute `/docs/...` link in the overlay is often copied verbatim from the
 * English page (the export kept it, or the translation reused the block). When
 * that page is just as dead upstream, the mirror did not break it and it must
 * not count as a failure: `deadRoute` is split into `upstreamDead` (inherited)
 * and `myDead` (introduced here). Relative `.md` links are resolved from the
 * source page before the comparison.
 */
function sourceHasTarget(file, rel, target) {
  if (!fs.existsSync(file)) return false;
  for (const link of extractLinks(fs.readFileSync(file, 'utf8'))) {
    if (link.kind === 'image') continue;
    const {pathPart} = splitSuffix(link.url);
    if (!pathPart) continue;
    let slug = null;
    if (pathPart.startsWith('/')) {
      const parsed = parseTarget(pathPart);
      if (parsed.kind === 'docs') slug = parsed.slug;
    } else if (/\.mdx?$/i.test(pathPart)) {
      const resolved = path.posix
        .normalize(path.posix.join(path.posix.dirname(rel), pathPart))
        .replace(/^\.\//, '');
      if (!resolved.startsWith('../')) slug = normaliseSlug(resolved);
    }
    if (slug === target.slug) return true;
  }
  return false;
}

/** A relative Markdown link, resolved from the page that carries it. */
function resolveRelative(rel, url) {
  const {pathPart} = splitSuffix(url);
  if (!/\.mdx?$/i.test(pathPart)) return {notMarkdown: true};
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), pathPart)).replace(/^\.\//, '');
  if (resolved.startsWith('../')) return {outside: true};
  return {file: resolved, slug: normaliseSlug(resolved)};
}

/** Front-matter titles, read once per file. */
const titleCache = new Map();
function frontMatterTitle(file) {
  if (titleCache.has(file)) return titleCache.get(file);
  const value = fs.existsSync(file)
    ? readField(splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter, 'title')
    : null;
  titleCache.set(file, value);
  return value;
}

/**
 * Is this link's visible text the English title of a page that is translated?
 *
 * That is the only title defect worth failing on: the target has a Chinese
 * `title`, so the English label could and should have been translated. A link
 * to a page that has no Chinese title yet is tolerated - there is nothing to
 * point the text at. The comparison is `normalize-links`' own
 * (`classifyLinkText`): case, whitespace, punctuation and a leading article do
 * not count, so the check and the rewrite can never disagree.
 *
 * Returns `'failed'` for a defect, `'tolerated'` for a lowercase ASCII
 * identifier that matches the English title, and `null` otherwise.
 */
function linkTitleIsUntranslated(section, version, rel, link) {
  if (link.kind === 'image' || !link.text || !link.text.trim()) return null;
  const {pathPart} = splitSuffix(link.url);
  if (!pathPart) return null;
  let slug = null;
  let targetSection = section;
  let targetVersion = version;
  if (!pathPart.startsWith('/')) {
    if (!/\.mdx?$/i.test(pathPart)) return null;
    const resolved = path.posix
      .normalize(path.posix.join(path.posix.dirname(rel), pathPart))
      .replace(/^\.\//, '');
    if (resolved.startsWith('../')) return null;
    slug = normaliseSlug(resolved);
  } else {
    if (SCHEME.test(pathPart)) return null;
    const target = parseTarget(pathPart);
    if (target.kind !== 'docs') return null;
    slug = target.slug;
    // A link into another release resolves inside the release it names.
    if (target.version && target.version !== version) {
      targetSection = SECTIONS.find((item) => item.name === `docs-${target.version}`) || section;
      targetVersion = target.version;
    }
  }
  const entry = routeTable(targetVersion || currentVersion()).entries.get(slug);
  if (!entry?.file) return null;
  const english = frontMatterTitle(path.join(REPO, targetSection.source, entry.file));
  const chinese = frontMatterTitle(path.join(REPO, targetSection.overlay, entry.file));
  if (!english || !chinese || !CJK.test(chinese)) return null;
  return classifyLinkText(link.text, english);
}

for (const section of SECTIONS) {
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  const sourceBase = path.join(REPO, section.source);
  const version = sectionVersion(section.name);
  const locale = sectionLocale(section);
  // A non-versioned section (hardware, blog, changelog) still links into the
  // docs; those links belong to the current release.
  const table = routeTable(version || currentVersion());
  const counts = {
    files: 0,
    relative: 0,
    relativeNonMd: 0,
    absolute: 0,
    external: 0,
    official: 0,
    mdSuffixAbsolute: 0,
    deadRoute: 0,
    myDead: 0,
    upstreamDead: 0,
    absoluteHtml: 0,
    htmlNoLocale: 0,
    crossVersion: 0,
    officialInternal: 0,
    overlayMissing: 0,
    localeInRelative: 0,
    shouldBeRelative: 0,
    failedTitle: 0,
    toleratedTitle: 0,
  };
  // Three examples per kind: enough to see what a bucket holds without burying
  // the summary in thousands of identical lines.
  const samples = new Map();
  const note = (kind, where, link) => {
    const list = samples.get(kind) || [];
    if (list.length < SAMPLE_LIMIT) list.push(`${where} -> ${link}`);
    samples.set(kind, list);
  };

  for (const file of walkMarkdown(overlayBase)) {
    counts.files++;
    const rel = relative(overlayBase, file);
    const text = fs.readFileSync(file, 'utf8');

    for (const link of extractLinks(text)) {
      if (link.kind === 'image') continue;
      const titleState = linkTitleIsUntranslated(section, version, rel, link);
      if (titleState === 'tolerated') {
        counts.toleratedTitle++;
      } else if (titleState === 'failed') {
        counts.failedTitle++;
        note('failed-title', `${section.name}/${rel}`, `${JSON.stringify(link.text.trim())} -> ${link.url}`);
      }
      const {pathPart} = splitSuffix(link.url);
      if (!pathPart) continue;
      if (SCHEME.test(pathPart)) continue;

      if (!pathPart.startsWith('/')) {
        // Relative: the desired form for a docs page, but it has to point at a
        // file this locale really has.
        if (ASSET.test(pathPart)) {
          counts.external++;
          continue;
        }
        const resolved = resolveRelative(rel, link.url);
        if (resolved.notMarkdown) {
          // A relative route without `.md` is not retargeted by `mdx-loader`;
          // inside the Chinese tree it resolves from `/zh-Hans` and loses the
          // `/docs` prefix. Count it as a defect instead of hiding it in
          // `external`, which is what let the cmr links ship.
          counts.relativeNonMd++;
          note('relative-non-md', `${section.name}/${rel}`, link.url);
          continue;
        }
        counts.relative++;
        if (resolved.outside) {
          counts.deadRoute++;
          note('outside-section', `${section.name}/${rel}`, link.url);
          continue;
        }
        if (/\/zh-Hans(\/|$)/.test(resolved.file)) {
          // The locale is added by the docs plugin; spelling it here produces
          // `/zh-Hans/zh-Hans/...`.
          counts.localeInRelative++;
          note('locale-in-relative', `${section.name}/${rel}`, link.url);
        }
        if (fs.existsSync(path.join(overlayBase, resolved.file))) continue;
        // No overlay for the target: the Chinese build reports a broken
        // Markdown link, so the link must have stayed absolute.
        counts.overlayMissing++;
        note('overlay-missing', `${section.name}/${rel}`, link.url);
        continue;
      }

      const target = parseTarget(pathPart);
      if (target.kind !== 'docs') {
        if (/^https?:/i.test(pathPart)) counts.external++;
        else counts.absolute++;
        continue;
      }
      if (target.official) counts.official++;
      if (/\.mdx?$/i.test(pathPart)) {
        counts.mdSuffixAbsolute++;
        note('md-suffix-absolute', `${section.name}/${rel}`, link.url);
        continue;
      }
      const entry = table.entries.get(target.slug);
      if (!entry) {
        const other = target.version && target.version !== table.version ? routeTable(target.version) : null;
        if (other?.entries.has(target.slug)) {
          // A deliberate link into another release: it resolves, but it leaves
          // this version, so it is reported without being an error on its own.
          counts.crossVersion++;
          continue;
        }
        counts.deadRoute++;
        // Same route missing on the English page: inherited, not our defect.
        if (sourceHasTarget(path.join(sourceBase, rel), rel, target)) {
          counts.upstreamDead++;
          note('upstream-dead', `${section.name}/${rel}`, link.url);
        } else {
          counts.myDead++;
          note('my-dead', `${section.name}/${rel}`, link.url);
        }
        continue;
      }
      if (target.official) {
        counts.officialInternal++;
        note('official-internal', `${section.name}/${rel}`, link.url);
        continue;
      }
      const overlay = path.join(overlayBase, entry.file || '');
      if (version && entry.file && fs.existsSync(overlay)) {
        // It could have been relative; that is the bucket the rebuild empties.
        // A raw `<a href>` is the exception: MDX renders it verbatim, so an
        // absolute URL is the only form that works - but it has to spell the
        // locale, otherwise the reader lands on the English page of that route.
        if (link.kind === 'html') {
          if (locale && target.locale !== locale) {
            counts.htmlNoLocale++;
            note('html-no-locale', `${section.name}/${rel}`, link.url);
          } else {
            counts.absoluteHtml++;
            note('absolute-html', `${section.name}/${rel}`, link.url);
          }
        } else {
          counts.shouldBeRelative++;
          note('should-be-relative', `${section.name}/${rel}`, link.url);
        }
      } else {
        counts.absolute++;
      }
    }

    if (!version) continue;
    // Title: an overlay title that is still the English one is not translated.
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const english = readField(splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter, 'title');
    const chinese = readField(splitFrontMatter(text).frontMatter, 'title');
    if (!english || !chinese) continue;
    if (chinese.trim() !== english.trim()) continue;
    if (CJK.test(chinese)) continue;
    // The title is not clickable: it is reported, but it is not the defect the
    // link-text check above fails on.
    counts.toleratedTitle++;
  }

  details[section.name] = counts;
  sectionSamples.set(section.name, samples);
  for (const [kind, list] of samples) {
    for (const sample of list) console.log(`  ${kind}: ${sample}`);
  }
}

/** Defects the rebuild is expected to clear. */
const defectKinds = [
  'relativeNonMd',
  'htmlNoLocale',
  'mdSuffixAbsolute',
  'myDead',
  'officialInternal',
  'overlayMissing',
  'localeInRelative',
  'shouldBeRelative',
];

const totals = {
  defects: 0,
  absolute: 0,
  crossVersion: 0,
  failedTitle: 0,
  myDead: 0,
  upstreamDead: 0,
  absoluteHtml: 0,
  htmlNoLocale: 0,
  toleratedTitle: 0,
};
for (const [name, counts] of Object.entries(details)) {
  const broken = defectKinds.reduce((sum, kind) => sum + counts[kind], 0);
  totals.defects += broken;
  totals.absolute += counts.absolute;
  totals.crossVersion += counts.crossVersion;
  totals.failedTitle += counts.failedTitle;
  totals.myDead += counts.myDead;
  totals.upstreamDead += counts.upstreamDead;
  totals.absoluteHtml += counts.absoluteHtml;
  totals.htmlNoLocale += counts.htmlNoLocale;
  totals.toleratedTitle += counts.toleratedTitle;
  console.log(`  ${broken ? 'FAIL' : 'ok  '} ${name}: ${JSON.stringify(counts)}`);
  if (broken) failures.push(`${name}: ${broken} link defect(s)`);
  if (counts.failedTitle) failures.push(`${name}: ${counts.failedTitle} link text(s) still the English title`);
}

// TOTAL stays within the last few lines on purpose: it is the number a reader
// checks first, and the failed-title examples below it are the rest.
if (failures.length) for (const line of failures) console.log(`FAIL ${line}`);
console.log(`TOTAL ${JSON.stringify(totals)}`);
if (totals.failedTitle) {
  const examples = [];
  for (const [name, counts] of Object.entries(details)) {
    if (!counts.failedTitle) continue;
    for (const line of sectionSamples.get(name)?.get('failed-title') || []) examples.push(`${name}: ${line}`);
  }
  console.log(`failedTitle=${totals.failedTitle} (English link text pointing at a Chinese title); examples:`);
  // One example per section first, so the tail shows all three releases.
  const picked = [];
  for (const name of Object.keys(details)) {
    const line = sectionSamples.get(name)?.get('failed-title')?.[0];
    if (line && picked.length < SAMPLE_LIMIT) picked.push(`${name}: ${line}`);
  }
  for (const example of examples) {
    if (picked.length >= SAMPLE_LIMIT) break;
    if (!picked.includes(example)) picked.push(example);
  }
  for (const example of picked) console.log(`  ${example}`);
}
if (failures.length) process.exitCode = 1;
