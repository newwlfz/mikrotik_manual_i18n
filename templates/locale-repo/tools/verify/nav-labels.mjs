#!/usr/bin/env node
/**
 * Dedicated release assertion for the archived Next/Previous navigation-label fix.
 *
 * Scope is deliberately narrow. This gate checks exactly two things added by
 * the fix and nothing else:
 *
 *   1. Archived docs overlays whose *English source front matter* carries a
 *      `sidebar_label` and whose own title is translated must carry the label
 *      derived by the repository's own `sidebarLabelZh()` policy. Pages whose
 *      English label only comes from a sidebar item are a different, older
 *      debt handled by tools/verify/labels.mjs; they are out of scope here.
 *   2. In the built HTML, a pagination card pointing at a page with a
 *      translated title must not render English prose.
 *
 * PDF links, newsletter titles, UI copy and compare-versions labels are NOT
 * checked here: those pre-existing debts must not hold up this release.
 * The locale comes from the repository profile (zh-Hans/zh-Hant), so the
 * script check follows the current locale rather than a hard-coded one.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  REPO,
  SECTIONS,
  localeRoot,
  glossaryFile,
  walkMarkdown,
  relative,
} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {sidebarLabelZh, shortLabel, isCliReferencePage} from '../translate/lib/labels.mjs';
import {scriptIssues} from '../translate/lib/script-check.mjs';
import {archivedVersions, currentVersionOrNull} from '../sync/lib/versions.mjs';

const failures = [];
const details = {};
let overlayFailed = false;
let paginationFailed = false;

/** Translated means: target-script characters present and no wrong-script wording. */
const isTranslated = (value) => {
  const text = String(value ?? '');
  return /[\u3400-\u9fff]/.test(text) && scriptIssues(text, DEFAULT_TARGET_LOCALE).length === 0;
};
// Glossary terms such as `WinBox` / `Back To Home` are deliberately kept in
// English by policy; only the annotated title carries the translation.
const glossaryFileForLocale = glossaryFile(DEFAULT_TARGET_LOCALE);
const glossary = (() => {
  const file = path.isAbsolute(glossaryFileForLocale)
    ? glossaryFileForLocale
    : path.join(REPO, glossaryFileForLocale);
  if (!fs.existsSync(file)) return new Map();
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return new Map(
    (parsed.terms || [])
      .filter((term) => term && term.source && term.target)
      .map((term) => [String(term.source).trim(), String(term.target).trim()]),
  );
})();
/**
 * A card label that is a policy-kept proper noun is not an untranslated nav
 * label. Two accepted forms: an exact glossary term whose target is itself,
 * and the short form derived from a translated title (`WinBox v3（旧版）` →
 * `WinBox v3`) by the repository's own `shortLabel()` policy.
 */
const isPolicyKept = (label, version, route, overlayFile) => {
  const text = String(label ?? '').trim();
  if (glossary.get(text) === text) return true;
  const section =
    SECTIONS.find((entry) => entry.name === `docs-${version}`) ||
    SECTIONS.find((entry) => entry.name === 'docs');
  if (!section || !overlayFile) return false;
  const relCandidates = [`${route}.md`, `${route}/index.md`, 'index.md'];
  const sourceFile = relCandidates
    .map((rel) => path.join(REPO, section.source, rel))
    .find((file) => fs.existsSync(file));
  if (!sourceFile) return false;
  const sourceFm = splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter;
  const overlayFm = splitFrontMatter(fs.readFileSync(overlayFile, 'utf8')).frontMatter;
  const derived = shortLabel(
    readField(sourceFm, 'sidebar_label') || readField(sourceFm, 'title') || '',
    readField(sourceFm, 'title') || '',
    readField(overlayFm, 'title') || '',
  );
  return Boolean(derived && derived === text && readField(overlayFm, 'sidebar_label') === text);
};
const isEnglishProse = (value) => {
  const text = String(value ?? '');
  return /[a-z]/.test(text) && (/[A-Z]/.test(text) || /\s/.test(text)) && !/[\u3400-\u9fff]/.test(text);
};

// (1) Archived overlays: the exact labels carried by the English source pages.
const overlayDetails = {};
for (const version of archivedVersions()) {
  const section = SECTIONS.find((entry) => entry.name === `docs-${version}`);
  if (!section) continue;
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  let checked = 0;
  let noSourceLabel = 0;
  const bad = [];
  for (const file of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, file).split(path.sep).join('/');
    if (isCliReferencePage(rel)) continue;
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const sourceFm = splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter;
    const englishLabel = readField(sourceFm, 'sidebar_label');
    if (!englishLabel) {
      // Sidebar-item fallback pages are a separate (pre-existing) debt.
      noSourceLabel++;
      continue;
    }
    const overlayFm = splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter;
    const zhTitle = readField(overlayFm, 'title') || '';
    if (!isTranslated(zhTitle)) continue;
    checked++;
    const zhLabel = readField(overlayFm, 'sidebar_label');
    const englishTitle = readField(sourceFm, 'title') || '';
    const expected = sidebarLabelZh({
      englishLabel,
      englishTitle,
      zhTitle,
      zhLabel,
    });
    // A label without target-script characters is accepted only when it is the
    // short form derived from the translated title (a product name such as
    // "WinBox v3" is policy, not an untranslated label).
    const properNoun = shortLabel(englishLabel, englishTitle, zhTitle) === expected;
    if (!expected || zhLabel !== expected || (!isTranslated(expected) && !properNoun)) {
      bad.push(`${rel}: "${zhLabel}" != "${expected}"`);
    }
  }
  overlayDetails[version] = {checked, noSourceLabel, bad: bad.length, samples: bad.slice(0, 5)};
  if (bad.length) {
    overlayFailed = true;
    failures.push(
      `navLabels: ${version} has ${bad.length} archived overlay(s) without a translated sidebar_label, e.g. ${bad.slice(0, 3).join('; ')}`,
    );
  }
}
details.archiveOverlays = overlayDetails;

// (2) Built HTML: pagination cards must follow translated target titles.
const buildRoot = path.join(REPO, 'build');
const localeDir = path.join(buildRoot, DEFAULT_TARGET_LOCALE);
const roots = fs.existsSync(localeDir) ? [localeDir] : [buildRoot];
const pagination = {
  locale: DEFAULT_TARGET_LOCALE,
  roots: roots.map((root) => relative(REPO, root)),
  checked: 0,
  english: 0,
  cliPages: 0,
  untranslatedTargets: 0,
  samples: [],
};
const current = currentVersionOrNull();
const overlayFor = (version, route) => {
  const slot = version === current ? 'current' : `version-${version}`;
  const base = path.join(
    REPO,
    localeRoot(DEFAULT_TARGET_LOCALE),
    'docusaurus-plugin-content-docs',
    slot,
  );
  return [`${route}.md`, `${route}/index.md`, 'index.md']
    .map((candidate) => path.join(base, candidate))
    .find((file) => fs.existsSync(file)) || null;
};
const walkHtml = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(file, out);
    else if (/\.html$/.test(entry.name)) out.push(file);
  }
  return out;
};
for (const root of roots) {
  for (const file of walkHtml(path.join(root, 'docs'))) {
    const rel = relative(root, file).split(path.sep).join('/');
    const match = /^docs\/(?:(\d+\.\d+)\/)?(.*)\/index\.html$/.exec(rel);
    if (!match) continue;
    const version = match[1] || current;
    const route = match[2];
    if (isCliReferencePage(route)) {
      pagination.cliPages++;
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const cards = [...html.matchAll(
      /<a\b[^>]*class="pagination-nav__link[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]{0,800}?<div class="pagination-nav__label">([^<]*)<\/div>/g,
    )];
    for (const [, href, rawLabel] of cards) {
      const label = rawLabel.trim();
      pagination.checked++;
      if (!isEnglishProse(label)) continue;
      const target = /\/docs(?:\/(\d+\.\d+))?\/([^?#]*)/.exec(decodeURIComponent(href));
      if (!target) continue;
      const targetVersion = target[1] || current;
      const targetRoute = target[2].replace(/\/+$/, '').replace(/\/index$/, '') || 'index';
      const overlayFile = overlayFor(targetVersion, targetRoute);
      if (!overlayFile) continue;
      if (isPolicyKept(label, targetVersion, targetRoute, overlayFile)) continue;
      const title = readField(
        splitFrontMatter(fs.readFileSync(overlayFile, 'utf8')).frontMatter,
        'title',
      ) || '';
      if (!isTranslated(title)) {
        pagination.untranslatedTargets++;
        continue;
      }
      pagination.english++;
      if (pagination.samples.length < 5) {
        pagination.samples.push(`${rel} → ${label} (${targetVersion}/${targetRoute})`);
      }
    }
  }
}
details.paginationBuild = pagination;
if (!pagination.checked) {
  paginationFailed = true;
  failures.push('navLabels: no pagination cards found in build/docs; run the locale build before verify:deploy');
}
if (pagination.english) {
  paginationFailed = true;
  failures.push(
    `navLabels: ${pagination.english} translated page(s) with an English pagination label, e.g. ${pagination.samples.slice(0, 3).join('; ')}`,
  );
}

console.log(`  ${overlayFailed ? 'FAIL' : 'ok  '} archiveOverlays: ${JSON.stringify(details.archiveOverlays)}`);
console.log(`  ${paginationFailed ? 'FAIL' : 'ok  '} paginationBuild: ${JSON.stringify(details.paginationBuild)}`);
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS nav-labels: archived sidebar labels and built pagination labels are localized');
}
