#!/usr/bin/env node
/**
 * Sidebar / pagination label checks.
 *
 * Rules that used to be enforced by nothing, and that a new release broke
 * silently because a missing label only shows up as English text inside the
 * Previous/Next cards:
 *
 *   1. every docs page that has an English `sidebar_label` also has a Chinese
 *      one in the overlay (otherwise Docusaurus shows the English sidebar text);
 *   2. the Hardware Guides translate their categories but never their product
 *      models - and both halves read config/sidebar-labels.yml, so the policy is
 *      what the verifier asserts, not a copy of it;
 *   3. the recurring "Newsletter <Month> <Year>" posts use the canonical title
 *      from normalize-titles.mjs, keep their English tag labels, and do not slip
 *      back to 时事通讯 / 新闻通讯.
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {
  DEFAULT_TARGET_LOCALE,
  SECTIONS,
  REPO,
  overlayRootFor,
  localeRoot,
  glossaryFile,
  walkMarkdown,
  relative,
} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {canonicalTitle} from '../translate/normalize-titles.mjs';
import {hardwareTitle, titleSuffixPolicy} from '../translate/normalize-hardware-titles.mjs';
import {deprecatedNewsletterTerms} from '../translate/normalize-newsletter.mjs';
import {allVersions, currentVersion, currentVersionOrNull, versionForSection} from '../sync/lib/versions.mjs';
import {COMPARE_VERSIONS} from '../translate/normalize-cli-headers.mjs';

/**
 * Whole-page translation exclusions (config/translation-exclusions.yml) keep
 * pages such as the official multilingual Quick Guides in the English source
 * bytes. The series-title assertion below must not demand the "系列" suffix on
 * a page the pipeline is *required* to leave byte-identical: that is a policy
 * exclusion, not a missing translation. The rule mirrors isTranslationExcluded()
 * in lib/apply.mjs and reads the same config, so a new exclusion is honoured
 * here without a regex edit. A repository without the config (the English hub)
 * has no excluded pages and keeps the exact same assertion.
 */
const EXCLUSIONS_FILE = path.join(REPO, 'config/translation-exclusions.yml');
const exclusionRules = (() => {
  if (!fs.existsSync(EXCLUSIONS_FILE)) return [];
  try {
    const parsed = YAML.parse(fs.readFileSync(EXCLUSIONS_FILE, 'utf8')) || {};
    return Array.isArray(parsed.exclusions) ? parsed.exclusions : [];
  } catch {
    // A malformed config is not permission to skip the assertion: keep the
    // original strict check (no exclusions) so a broken policy cannot turn a
    // real missing translation into a pass. The pipeline fails on bad YAML too.
    return [];
  }
})();
function isExcludedPage(section, rel) {
  const sourceRel = `${section.source}/${rel}`.split(path.sep).join('/');
  const segments = String(rel).split(/[\\/]/).map((part) => part.replace(/\.mdx?$/i, ''));
  return exclusionRules.some((rule) => {
    if (rule.section && rule.section !== section.name) return false;
    if ((rule.source_prefixes || []).some((prefix) => sourceRel.startsWith(String(prefix)))) {
      return true;
    }
    return (rule.overlay_segment_prefixes || []).some((prefix) =>
      segments.some((segment) => segment.startsWith(String(prefix))),
    );
  });
}

const CJK = /[\u4e00-\u9fff]/;
const failures = [];
const details = {};

/**
 * The English text Docusaurus resolves for a page with no front-matter label.
 *
 * Priority: `pagination_label` → `sidebar_label` → the label of the sidebar item
 * linking to the page → `title`. Archived captures predate the navigation-label
 * backfill, so their English source can have no `sidebar_label` at all: the
 * sidebar item label is still English and still wins over the Chinese title.
 * Reading it from `versioned_sidebars` makes the assertion cover archives too
 * instead of silently skipping every page without a front-matter label.
 */
const sidebarItemLabels = new Map();
function sidebarItemLabel(section, rel) {
  const version = versionForSection(section.name);
  if (!version) return null;
  let labels = sidebarItemLabels.get(version);
  if (!labels) {
    labels = new Map();
    const file = path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`);
    if (fs.existsSync(file)) {
      const tree = JSON.parse(fs.readFileSync(file, 'utf8')).docs || [];
      const visit = (items) => {
        for (const item of items || []) {
          if (!item || typeof item !== 'object') continue;
          if (item.type === 'doc' && item.id && typeof item.label === 'string') {
            labels.set(String(item.id).replace(/\/index$/, ''), item.label);
          }
          // A category that links to a doc renders its own label for that doc.
          if (item.type === 'category' && item.link?.id && typeof item.label === 'string') {
            const id = String(item.link.id).replace(/\/index$/, '');
            if (!labels.has(id)) labels.set(id, item.label);
          }
          if (item.items) visit(item.items);
        }
      };
      visit(tree);
    }
    sidebarItemLabels.set(version, labels);
  }
  const id = String(rel).replace(/\.mdx?$/, '').replace(/\/index$/, '');
  return labels.get(id) || null;
}

/**
 * Terms whose sidebar label is deliberately kept English.
 *
 * The glossary maps a source term to its agreed bilingual wording, e.g.
 * `Back To Home` -> `Back To Home（远程回家）`. When an overlay title is exactly
 * that wording, the English label is the short form of the same term and is
 * policy, not a missing translation; only a label with no glossary backing is a
 * defect. Reading the policy from the glossary keeps the verifier and the
 * translation pipeline on one source of truth.
 */
const glossary = (() => {
  // The repository's own glossary, not a hard-coded zh-Hans path: the zh-Hant
  // checkout keeps `config/glossary/zh-Hant.yml`, so the bilingual-term rule
  // silently had no authority there (`glossaryKept: 0`) and flagged the exact
  // labels the policy allows.
  const file = path.isAbsolute(glossaryFile(DEFAULT_TARGET_LOCALE))
    ? glossaryFile(DEFAULT_TARGET_LOCALE)
    : path.join(REPO, glossaryFile(DEFAULT_TARGET_LOCALE));
  if (!fs.existsSync(file)) return new Map();
  const parsed = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return new Map(
    (parsed.terms || [])
      .filter((term) => term && term.source && term.target)
      .map((term) => [String(term.source).trim(), String(term.target).trim()]),
  );
})();

function readYaml(rel) {
  const file = path.join(REPO, rel);
  if (!fs.existsSync(file)) return null;
  return YAML.parse(fs.readFileSync(file, 'utf8')) || {};
}

for (const section of SECTIONS.filter((entry) => /^docs/.test(entry.name))) {
  const sourceBase = path.join(REPO, section.source);
  const overlayBase = path.join(REPO, section.overlay);
  if (!fs.existsSync(overlayBase)) continue;
  let checked = 0;
  let glossaryKept = 0;
  const missing = [];
  for (const file of walkMarkdown(overlayBase)) {
    const rel = relative(overlayBase, file);
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const sourceLabel = readField(
      splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter,
      'sidebar_label',
    );
    // An archived English source may have no `sidebar_label` at all. In that
    // case Docusaurus uses the sidebar item label — which is English — so that
    // is the text the overlay must translate. Skipping such pages was exactly
    // how 7.24/7.25 escaped this assertion.
    const englishLabel = sourceLabel || sidebarItemLabel(section, rel);
    if (!englishLabel) continue;
    // A CLI command label is policy, not a translation: `/ip address add` must
    // stay typeable in the console (see lib/labels.mjs#isCliReferencePage).
    if (/^cli-reference\//.test(rel)) continue;
    checked++;
    const overlayFm = splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter;
    const zhTitle = readField(overlayFm, 'title') || '';
    const zhLabel = readField(overlayFm, 'sidebar_label');
    if (!CJK.test(zhTitle)) continue;
    // Two ways to fail: the English label was copied verbatim into the overlay,
    // or no Chinese label was written and the English sidebar text wins in the
    // Previous/Next card. A short acronym ("HTB") with no glossary backing and
    // no translated title is not in scope here.
    if (!zhLabel) {
      missing.push(rel);
      continue;
    }
    if (zhLabel !== englishLabel) continue;
    const agreed = glossary.get(englishLabel.trim());
    if (agreed && (zhTitle === agreed || zhTitle.startsWith(agreed))) {
      // The bilingual title carries the translation; the label is the term.
      glossaryKept++;
      continue;
    }
    missing.push(rel);
  }
  details[section.name] = {checked, missing: missing.length, glossaryKept};
  if (missing.length) {
    failures.push(`${section.name}: ${missing.length} page(s) without a Chinese sidebar_label, e.g. ${missing.slice(0, 3).join(', ')}`);
  }
}

// Hardware: the category wording is policy (config/sidebar-labels.yml), and the
// product titles may only move the trailing "series" word.
const sidebarPolicy = readYaml('config/sidebar-labels.yml') || {};
const hardwarePolicy = sidebarPolicy.hardware || {};
// Locale-aware wording: generate-ui.mjs reads locales.<locale>.hardware.categories.
// The legacy top-level map is the zh-Hans default; using it to judge a zh-Hant
// catalogue would report every reviewed Hant label as a false mismatch.
const policyCategories =
  sidebarPolicy.locales?.[DEFAULT_TARGET_LOCALE]?.hardware?.categories ||
  hardwarePolicy.categories ||
  {};
const keepEnglish = new Set(hardwarePolicy.keep_english || []);
const suffix = titleSuffixPolicy();
const hardwareDetails = {};

// Resolve this checkout's hardware overlay once through the shared helper, so
// the hardware catalogue, the overlay scan and the PDF scan all follow the
// repository's own locale (the template keeps the zh-Hans placeholder).
const hardwareOverlayRel = overlayRootFor(DEFAULT_TARGET_LOCALE, 'hardware');

const hardwareFile = path.join(REPO, `${hardwareOverlayRel}.json`);
if (fs.existsSync(hardwareFile)) {
  const entries = JSON.parse(fs.readFileSync(hardwareFile, 'utf8'));
  const categories = Object.entries(entries).filter(([key]) => key.includes('.category.'));
  const categoryPrefix = 'sidebar.hardware.category.';
  const englishLabel = (key) => (key.startsWith(categoryPrefix) ? key.slice(categoryPrefix.length) : key.split('.category.').pop());
  const untranslated = categories
    .filter(([key, value]) => !CJK.test(value.message) && !keepEnglish.has(englishLabel(key)) && !keepEnglish.has(value.message))
    .map(([key]) => englishLabel(key));
  // Every category must have an explicit mapping: a new "Foo" category may not
  // silently fall back to whatever the legacy memory happens to hold.
  const uncovered = categories
    .filter(([key]) => !(englishLabel(key) in policyCategories))
    .map(([key]) => englishLabel(key));
  // The generated catalogue must equal the policy, so editing one without the
  // other is caught instead of shipping a stale label.
  const mismatched = categories
    .filter(([key, value]) => policyCategories[englishLabel(key)] && value.message !== policyCategories[englishLabel(key)])
    .map(([key]) => englishLabel(key));
  const productKeys = Object.keys(entries).filter((key) => key.includes('.doc.'));
  Object.assign(hardwareDetails, {
    categories: categories.length,
    untranslated: untranslated.length,
    uncovered: uncovered.length,
    mismatched: mismatched.length,
    docLabels: productKeys.length,
  });
  if (untranslated.length) failures.push(`hardware: ${untranslated.length} category label(s) still English: ${untranslated.slice(0, 3).join(', ')}`);
  if (uncovered.length) failures.push(`hardware: ${uncovered.length} category label(s) missing from config/sidebar-labels.yml: ${uncovered.slice(0, 3).join(', ')}`);
  if (mismatched.length) failures.push(`hardware: ${mismatched.length} category label(s) differ from config/sidebar-labels.yml: ${mismatched.slice(0, 3).join(', ')}`);
  if (productKeys.length) failures.push(`hardware: ${productKeys.length} product label(s) are localised; model names must stay English`);
}

const hardwareOverlay = path.join(REPO, hardwareOverlayRel);
if (fs.existsSync(hardwareOverlay)) {
  const sourceBase = path.join(REPO, 'hardware');
  const hardwareSection = SECTIONS.find((section) => section.name === 'hardware');
  let files = 0;
  const badFrontMatter = [];
  let seriesChecked = 0;
  const seriesBad = [];
  for (const file of walkMarkdown(hardwareOverlay)) {
    files++;
    const text = fs.readFileSync(file, 'utf8');
    // A rebuild once wrote overlays without front matter; `head -1` is the cheap
    // way to notice, and losing the title/slug silently breaks the sidebar.
    if (!/^---\r?\n[\s\S]*?\r?\n---\r?\n/.test(text)) badFrontMatter.push(relative(hardwareOverlay, file));
    const rel = relative(hardwareOverlay, file);
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    const english = readField(splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter, 'title');
    if (!english) continue;
    // Quick Guides and other whole-page exclusions stay in the English source
    // bytes by policy; demanding a translated "系列" on them would be a
    // false positive. The front-matter check above still applies to every page.
    if (hardwareSection && isExcludedPage(hardwareSection, rel)) continue;
    const wanted = hardwareTitle(english);
    if (wanted === english) continue;
    // Only titles the policy actually rewrites are checked: "mANT-series" must
    // become "mANT 系列", and nothing else in the model name may change.
    seriesChecked++;
    const zhTitle = readField(splitFrontMatter(text).frontMatter, 'title') || '';
    if (zhTitle !== wanted || !zhTitle.endsWith(` ${suffix.to}`)) seriesBad.push(`${rel}: ${zhTitle} != ${wanted}`);
  }
  Object.assign(hardwareDetails, {
    overlays: files,
    frontMatterOk: files - badFrontMatter.length,
    seriesChecked,
    seriesBad: seriesBad.length,
  });
  if (badFrontMatter.length) failures.push(`hardware: ${badFrontMatter.length} overlay(s) without front matter, e.g. ${badFrontMatter.slice(0, 3).join(', ')}`);
  if (seriesBad.length) failures.push(`hardware: ${seriesBad.length} title(s) do not use the configured "${suffix.to}" suffix, e.g. ${seriesBad.slice(0, 3).join('; ')}`);
}

if (Object.keys(hardwareDetails).length) details.hardware = hardwareDetails;

// Docs categories: Docusaurus itself creates `sidebar.docs.category.<key>` for
// every sidebar category; the old generator emitted only 12 of them, leaving
// 18 of the 20 first-level entries in English. Assert every version's
// first-level categories have a catalogue key with Chinese wording (or an
// explicit keep-English entry), and that the label policy covers the whole
// non-CLI tree - a new category cannot silently fall back to English.
const docsPolicy = sidebarPolicy.docs || {};
const docsCategories =
  sidebarPolicy.locales?.[DEFAULT_TARGET_LOCALE]?.docs?.categories ||
  docsPolicy.categories ||
  {};
const docsKeepPrefixes = (docsPolicy.keep_english || []).map((value) => String(value));
const docsCategoryWhitelist = new Set(docsKeepPrefixes.map((value) => value.replace(/\/$/, '')));

const docsCurrentVersion = currentVersionOrNull();
function readDocsSidebarFile(file) {
  if (!fs.existsSync(file)) return null;
  if (file.endsWith('.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    return JSON.parse(
      text.slice(text.indexOf('= {') + 2, text.lastIndexOf('};') + 1).replace(/,\s*([}\]])/g, '$1'),
    ).docs;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')).docs;
}
function readDocsSidebar(version) {
  return docsCurrentVersion && version === docsCurrentVersion
    ? readDocsSidebarFile(path.join(REPO, 'sidebars.ts'))
    : readDocsSidebarFile(path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`));
}

/** Walk the tree exactly like generate-ui.mjs: CLI subtrees stay English. */
function docsNonCliKeys(tree) {
  const keys = [];
  const walk = (items, cli) => {
    for (const node of items || []) {
      if (!node || typeof node !== 'object') continue;
      const key = String(node.key ?? node.label ?? '');
      if (node.type === 'category' && node.label && !cli) keys.push(key);
      const next =
        cli ||
        docsKeepPrefixes.some((prefix) => key.startsWith(prefix)) ||
        node.label === 'CLI Reference';
      if (node.items) walk(node.items, next);
    }
  };
  walk(tree, false);
  return keys;
}

const docsCatalogueDir = path.join(
  REPO,
  localeRoot(DEFAULT_TARGET_LOCALE),
  'docusaurus-plugin-content-docs',
);
const docsTree =
  readDocsSidebarFile(path.join(REPO, 'sidebars.ts')) || readDocsSidebar(allVersions()[0]);
const docsDetails = {
  configCategories: Object.keys(docsCategories).length,
  treeCategories: docsNonCliKeys(docsTree || []).length,
  versions: {},
  missingKeys: 0,
  englishMessages: 0,
  configUncovered: 0,
};
const docsMissing = [];
const docsEnglish = [];
const docsConfigMiss = [];
for (const version of allVersions()) {
  const tree = readDocsSidebar(version);
  if (!tree) continue;
  const firstLevel = (tree || []).filter((node) => node && node.type === 'category' && node.label);
  const catalogueFile = path.join(
    docsCatalogueDir,
    `${version === docsCurrentVersion ? 'current' : `version-${version}`}.json`,
  );
  // The scaffold template has no locale catalogue yet; only a real checkout
  // with a catalogue can assert the generated keys.
  const catalogue = fs.existsSync(catalogueFile)
    ? JSON.parse(fs.readFileSync(catalogueFile, 'utf8'))
    : null;
  const missingKeys = [];
  const englishMessages = [];
  if (catalogue) {
    for (const node of firstLevel) {
      const key = String(node.key ?? node.label);
      const entry = catalogue[`sidebar.docs.category.${key}`];
      if (!entry) {
        missingKeys.push(key);
        continue;
      }
      const message = String(entry.message ?? '');
      if (
        !CJK.test(message) &&
        !docsCategoryWhitelist.has(key) &&
        !docsCategoryWhitelist.has(message)
      ) {
        englishMessages.push(`${key}=${message}`);
      }
    }
  }
  const uncovered = docsNonCliKeys(tree).filter((key) => !(key in docsCategories));
  docsDetails.versions[version] = {
    firstLevel: firstLevel.length,
    catalogue: catalogue ? 'present' : 'not-scaffolded',
    missingKeys: missingKeys.length,
    englishMessages: englishMessages.length,
    uncovered: uncovered.length,
  };
  docsDetails.missingKeys += missingKeys.length;
  docsDetails.englishMessages += englishMessages.length;
  docsDetails.configUncovered += uncovered.length;
  if (missingKeys.length) docsMissing.push(`${version}: ${missingKeys.slice(0, 5).join(', ')}`);
  if (englishMessages.length) docsEnglish.push(`${version}: ${englishMessages.slice(0, 5).join(', ')}`);
  if (uncovered.length) docsConfigMiss.push(`${version}: ${uncovered.slice(0, 5).join(', ')}`);
}
details.docsCategories = docsDetails;
if (docsDetails.configCategories !== docsDetails.treeCategories) {
  failures.push(
    `docsCategories: config has ${docsDetails.configCategories} category label(s) but the tree has ${docsDetails.treeCategories} non-CLI categories`,
  );
}
if (docsDetails.configUncovered) {
  failures.push(
    `docsCategories: ${docsDetails.configUncovered} category key(s) missing from config/sidebar-labels.yml: ${docsConfigMiss.join('; ')}`,
  );
}
if (docsDetails.missingKeys) {
  failures.push(
    `docsCategories: ${docsDetails.missingKeys} first-level category key(s) missing from the docs catalogue: ${docsMissing.join('; ')}`,
  );
}
if (docsDetails.englishMessages) {
  failures.push(
    `docsCategories: ${docsDetails.englishMessages} first-level category message(s) still English: ${docsEnglish.join('; ')}`,
  );
}

// zh-Hant sidebar categories: no Simplified characters / mainland wording in
// ANY sidebar.docs.category.* message, and every first-level category message
// must equal the reviewed locales.zh-Hant value in config/sidebar-labels.yml.
// This is the assertion that was missing: generate-ui used to return one shared
// Simplified map, so 352/352 category keys were byte-identical between Hans and
// Hant. The character/word tables are imported from script-check.mjs so the
// verifier and the translation gate share one source of truth. The English hub
// has no script-check.mjs / zh-Hant catalogue, so it reports the skip.
const hantScriptCheckPath = path.join(REPO, 'tools/translate/lib/script-check.mjs');
const hantScriptCheck = fs.existsSync(hantScriptCheckPath)
  ? await import(pathToFileURL(hantScriptCheckPath).href)
  : null;
if (!hantScriptCheck || !/^zh-Hant$/i.test(DEFAULT_TARGET_LOCALE)) {
  details.hantCategories = {
    skipped: !hantScriptCheck
      ? 'no script-check.mjs in this (English hub) repository'
      : `locale is ${DEFAULT_TARGET_LOCALE}`,
  };
} else {
  const hantConfig = readYaml('config/sidebar-labels.yml')?.locales?.['zh-Hant'];
  const hantCategories = hantConfig?.docs?.categories || {};
  const hantDetails = {
    configPresent: Boolean(hantConfig?.docs?.categories),
    catalogues: 0,
    categoryMessages: 0,
    simplifiedMessages: 0,
    firstLevelChecked: 0,
    mismatched: 0,
    versions: {},
  };
  if (!hantConfig?.docs?.categories) {
    failures.push(
      'hantCategories: config/sidebar-labels.yml has no locales.zh-Hant.docs.categories; ' +
        'a zh-Hant catalogue must never fall back to the Simplified defaults',
    );
  }
  const hantBad = [];
  const hantMismatch = [];
  for (const version of allVersions()) {
    const tree = readDocsSidebar(version);
    if (!tree) continue;
    const firstLevel = (tree || []).filter((node) => node && node.type === 'category' && node.label);
    const catalogueFile = path.join(
      docsCatalogueDir,
      `${version === docsCurrentVersion ? 'current' : `version-${version}`}.json`,
    );
    if (!fs.existsSync(catalogueFile)) continue;
    const catalogue = JSON.parse(fs.readFileSync(catalogueFile, 'utf8'));
    hantDetails.catalogues++;
    let bad = 0;
    let mismatch = 0;
    for (const [key, value] of Object.entries(catalogue)) {
      if (!key.startsWith('sidebar.docs.category.')) continue;
      hantDetails.categoryMessages++;
      if (hantScriptCheck.scriptIssues(String(value?.message ?? ''), 'zh-Hant').length) bad++;
    }
    for (const node of firstLevel) {
      const key = String(node.key ?? node.label);
      const expected = hantCategories[key];
      const actual = catalogue[`sidebar.docs.category.${key}`]?.message;
      hantDetails.firstLevelChecked++;
      if (expected === undefined || actual !== expected) mismatch++;
    }
    hantDetails.simplifiedMessages += bad;
    hantDetails.mismatched += mismatch;
    hantDetails.versions[version] = {
      firstLevel: firstLevel.length,
      simplifiedMessages: bad,
      mismatched: mismatch,
    };
    if (bad) hantBad.push(`${version}: ${bad}`);
    if (mismatch) hantMismatch.push(`${version}: ${mismatch}`);
  }
  details.hantCategories = hantDetails;
  if (hantDetails.simplifiedMessages) {
    failures.push(
      `hantCategories: ${hantDetails.simplifiedMessages} sidebar.docs.category.* message(s) still use ` +
        `Simplified characters/mainland wording: ${hantBad.join('; ')}`,
    );
  }
  if (hantDetails.mismatched) {
    failures.push(
      `hantCategories: ${hantDetails.mismatched} first-level category message(s) differ from ` +
        `locales.zh-Hant in config/sidebar-labels.yml: ${hantMismatch.join('; ')}`,
    );
  }
}

// PDF attachments: the export lost the content hash, so a link is only valid if
// the cached file exists under static/.
const pdfMissing = [];
for (const dir of ['hardware', hardwareOverlayRel]) {
  const base = path.join(REPO, dir);
  if (!fs.existsSync(base)) continue;
  for (const file of walkMarkdown(base)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\/assets\/files\/([^)\s"]+\.pdf)/g)) {
      if (!fs.existsSync(path.join(REPO, 'static/assets/files', match[1]))) pdfMissing.push(`${dir}/${relative(base, file)}: ${match[1]}`);
    }
  }
}
details.pdfs = {missing: pdfMissing.length};
if (pdfMissing.length) failures.push(`pdfs: ${pdfMissing.length} link(s) without a cached file, e.g. ${pdfMissing.slice(0, 3).join(', ')}`);

// Blog: titles follow canonicalTitle(), tag labels/permalink stay English, and
// the prose uses the glossary wording for "newsletter".
function tagFields(frontMatter) {
  const parsed = YAML.parse(frontMatter) || {};
  if (!Array.isArray(parsed.tags)) return [];
  return parsed.tags.map((tag) =>
    tag && typeof tag === 'object' ? [tag.label ?? null, tag.permalink ?? null] : [String(tag), null],
  );
}

const blogSection = SECTIONS.find((section) => section.name === 'blog');
const blogBase = blogSection ? path.join(REPO, blogSection.overlay) : null;
if (blogBase && fs.existsSync(blogBase)) {
  const sourceBase = path.join(REPO, blogSection.source);
  let posts = 0;
  const badTitles = [];
  const badTags = [];
  const badBodies = [];
  for (const file of walkMarkdown(blogBase)) {
    const rel = relative(blogBase, file);
    const sourceFile = path.join(sourceBase, rel);
    if (!fs.existsSync(sourceFile)) continue;
    posts++;
    const sourceText = fs.readFileSync(sourceFile, 'utf8');
    const overlayText = fs.readFileSync(file, 'utf8');
    const sourceFm = splitFrontMatter(sourceText).frontMatter;
    const overlayFm = splitFrontMatter(overlayText).frontMatter;
    const english = readField(sourceFm, 'title');
    let wanted = english ? canonicalTitle(english) : null;
    if (wanted && /^zh-Hant$/i.test(DEFAULT_TARGET_LOCALE)) {
      wanted = wanted.replace('新闻简报', '新聞簡報');
    }
    const zhTitle = readField(overlayFm, 'title') || '';
    if (wanted) {
      if (zhTitle !== wanted) badTitles.push(`${rel}: ${zhTitle} != ${wanted}`);
    } else if (english && /^newsletter\b/i.test(english)) {
      // "Newsletter" with a month/year we could not parse: a new spelling that
      // needs a canonical form instead of an English title slipping through.
      badTitles.push(`${rel}: unrecognised newsletter title "${english}"`);
    }
    const sourceTags = JSON.stringify(tagFields(sourceFm));
    const overlayTags = JSON.stringify(tagFields(overlayFm));
    if (sourceTags !== overlayTags) badTags.push(`${rel}: ${overlayTags} != ${sourceTags}`);
    const terms = deprecatedNewsletterTerms(splitFrontMatter(overlayText).body);
    if (terms.length) badBodies.push(`${rel}: ${terms.join('/')}`);
  }
  details.blog = {posts, englishTitles: badTitles.length, tagLabels: badTags.length, deprecatedWording: badBodies.length};
  if (badTitles.length) failures.push(`blog: ${badTitles.length} newsletter title(s) not normalised: ${badTitles.slice(0, 3).join('; ')}`);
  if (badTags.length) failures.push(`blog: ${badTags.length} post(s) with a translated tag label: ${badTags.slice(0, 3).join('; ')}`);
  if (badBodies.length) failures.push(`blog: ${badBodies.length} post(s) still using 时事通讯/新闻通讯: ${badBodies.slice(0, 3).join('; ')}`);
}

// Introduction: the one prose place outside the blog that names the newsletter.
const introBase = SECTIONS.filter((section) => /^docs/.test(section.name));
let introChecked = 0;
const introBad = [];
for (const section of introBase) {
  const file = path.join(REPO, section.overlay, 'introduction.md');
  if (!fs.existsSync(file)) continue;
  introChecked++;
  const terms = deprecatedNewsletterTerms(splitFrontMatter(fs.readFileSync(file, 'utf8')).body);
  if (terms.length) introBad.push(`${section.name}: ${terms.join('/')}`);
}
details.introductions = {checked: introChecked, deprecated: introBad.length};
if (introBad.length) failures.push(`introductions: ${introBad.length} introduction(s) still using 新闻通讯/时事通讯: ${introBad.slice(0, 3).join('; ')}`);

// English trees are English: a Chinese title or sidebar_label leaking into
// docs/** or versioned_docs/** is the same regression seen from the other side
// (it wins over the English label in the sidebar and the paginator).
let englishFiles = 0;
const englishCjk = [];
for (const dir of ['docs', 'versioned_docs']) {
  const base = path.join(REPO, dir);
  if (!fs.existsSync(base)) continue;
  for (const file of walkMarkdown(base)) {
    englishFiles++;
    const rel = relative(base, file);
    const fm = splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter;
    for (const field of ['title', 'sidebar_label']) {
      const value = readField(fm, field);
      if (value && CJK.test(String(value))) englishCjk.push(`${dir}/${rel}: ${field}=${value}`);
    }
  }
}
details.english = {files: englishFiles, cjk: englishCjk.length};
if (englishCjk.length) failures.push(`english: ${englishCjk.length} English title/sidebar_label with CJK: ${englishCjk.slice(0, 3).join('; ')}`);

// CLI `compare-versions`: the labels the page spells out in prose (the legend
// under "How the comparison works") are policy, not translation, and must read
// Chinese. The widget's field labels are the generated projection of the same
// table, so both halves are checked with a FIXED key set. It is deliberately
// hard-coded here instead of derived from `config/cli-labels.yml`: an empty
// table used to make this loop spin on zero keys and pass vacuously.
const COMPARE_VERSION_LABEL_KEYS = Object.freeze([
  'From', 'To', 'Filter', 'Swap versions', 'Swap From and To versions',
  'path, e.g. ip/firewall', 'parameters added', 'parameters removed',
  'commands changed', 'new commands', 'commands removed', 'New commands',
  'Removed commands', 'Parameter changes', 'parameters', 'flags', 'commands',
  'command', 'command measure word', 'Could not load',
  'Loading CLI reference versions…', 'Not enough CLI reference versions to compare.',
  'Select two different versions to compare.', 'No parameter differences.',
  'No parameter differences matching the filter.', ': ', ' of ',
]);
/** Separators are punctuation: no CJK is expected in their localized value. */
const COMPARE_SEPARATORS = new Set([': ', ' of ']);
const hasTargetScript = (value) => /[\u3400-\u9fff\uff00-\uffef]/.test(String(value));
/** English residue = empty, the English key itself, or plain English prose. */
const isEnglishLabel = (key, value) => {
  const text = String(value ?? '');
  if (!text.trim() || text === key) return true;
  if (COMPARE_SEPARATORS.has(key)) return false;
  return !hasTargetScript(text);
};

let compareChecked = 0;
const compareRemaining = [];
for (const section of SECTIONS.filter((entry) => /^docs/.test(entry.name))) {
  const file = path.join(REPO, section.overlay, 'cli-reference', COMPARE_VERSIONS);
  if (!fs.existsSync(file)) continue;
  compareChecked++;
  const body = splitFrontMatter(fs.readFileSync(file, 'utf8')).body;
  for (const match of body.matchAll(/(\*\*|\*)([^*\n]+?)\1/g)) {
    const inner = match[2].trim();
    const canonical = COMPARE_VERSION_LABEL_KEYS.find(
      (key) => key.toLowerCase() === inner.toLowerCase(),
    );
    if (canonical && isEnglishLabel(canonical, inner)) {
      compareRemaining.push(`${section.name}: ${match[0]}`);
    }
  }
}

// The interactive widget's generated table must carry every fixed key with a
// localized value. Read the JSON directly: the browser cannot import YAML, so
// this is the only file the widget actually renders.
const widgetFile = path.join(REPO, 'src/components/CliCompare/labels.data.json');
const widgetEnglish = [];
let widgetData = null;
if (fs.existsSync(widgetFile)) {
  try {
    widgetData = JSON.parse(fs.readFileSync(widgetFile, 'utf8'));
  } catch (error) {
    failures.push(`compare-versions widget: unreadable labels.data.json: ${error.message}`);
  }
} else {
  failures.push('compare-versions widget: missing labels.data.json');
}
if (widgetData) {
  for (const key of COMPARE_VERSION_LABEL_KEYS) {
    if (isEnglishLabel(key, widgetData[key])) widgetEnglish.push(key);
  }
}

details.compareVersions = {
  checked: compareChecked,
  englishLabels: compareRemaining.length,
  widgetKeys: COMPARE_VERSION_LABEL_KEYS.length,
  widgetEnglish: widgetEnglish.length,
};
if (compareRemaining.length) {
  failures.push(
    `compare-versions: ${compareRemaining.length} label(s) still English: ${compareRemaining.slice(0, 3).join('; ')}`,
  );
}
if (widgetEnglish.length) {
  failures.push(
    `compare-versions widget: ${widgetEnglish.length}/${COMPARE_VERSION_LABEL_KEYS.length} label(s) still English: ${widgetEnglish.slice(0, 5).join(', ')}`,
  );
}

// Version comparison sidebar entry: exactly one label in the whole tree, at the
// official position. The current version's official crawl lists it as the first
// CLI Reference item; the archived crawls have no entry, so the link to the
// current page is appended last. This is the label-level twin of the position
// check in sidebar-consistency.mjs and the DOM check in browser-check.mjs.
{
  const COMPARE_LABELS = new Set(['Version comparison', '版本比较']);
  const normalizeRoute = (value) =>
    String(value ?? '')
      .replace(/^\/docs\//, '')
      .replace(/\/index$/, '')
      .replace(/\/$/, '');
  const isCompare = (item) =>
    COMPARE_LABELS.has(String(item?.label ?? '').trim()) ||
    [item?.id, item?.link?.id, item?.href, item?.link?.href].some(
      (value) => normalizeRoute(value) === 'cli-reference/compare-versions',
    );
  const findCli = (items) => {
    for (const item of items || []) {
      if (/^cli reference$/i.test(String(item?.label ?? '').trim())) return item;
      if (item?.items) {
        const found = findCli(item.items);
        if (found) return found;
      }
    }
    return null;
  };
  const countCompare = (items) =>
    (items || []).reduce(
      (total, item) => total + (isCompare(item) ? 1 : 0) + countCompare(item?.items),
      0,
    );
  const readTree = (version) => {
    const file =
      version === currentVersion()
        ? path.join(REPO, 'sidebars.ts')
        : path.join(REPO, `versioned_sidebars/version-${version}-sidebars.json`);
    if (!fs.existsSync(file)) return null;
    if (file.endsWith('.ts')) {
      const text = fs.readFileSync(file, 'utf8');
      return JSON.parse(
        text.slice(text.indexOf('= {') + 2, text.lastIndexOf('};') + 1).replace(/,\s*([}\]])/g, '$1'),
      ).docs;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8')).docs;
  };

  const perVersion = {};
  const countBad = [];
  const positionBad = [];
  for (const version of allVersions()) {
    const tree = readTree(version);
    if (!tree) continue;
    const cliItems = findCli(tree)?.items || [];
    const index = cliItems.findIndex(isCompare);
    const expected = version === currentVersion() ? 0 : cliItems.length - 1;
    const total = countCompare(tree);
    perVersion[version] = {labelCount: total, index, expected, cliItems: cliItems.length};
    if (total !== 1) countBad.push(`${version}: ${total}`);
    if (index !== expected) positionBad.push(`${version}: index=${index} expected=${expected}`);
  }
  details.versionComparisonSidebar = {
    versions: perVersion,
    countBad: countBad.length,
    positionBad: positionBad.length,
  };
  if (countBad.length) {
    failures.push(
      `versionComparisonSidebar: ${countBad.length} version(s) without exactly one Version comparison label: ${countBad.join(', ')}`,
    );
  }
  if (positionBad.length) {
    failures.push(
      `versionComparisonSidebar: ${positionBad.length} version(s) with the entry at the wrong position: ${positionBad.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Component UI copy: static assertions that must run on every locale build.
//
// The React components render their English/Chinese strings from a `COPY` map
// (`const COPY = {...}` or `const COPY: Record<...> = {...}`). A new component
// that only ships `en` + `zh-Hans` silently falls back to English in the
// zh-Hant build, so every COPY map must carry all three keys. Separately, a
// stale `build/` can still hold the old hard-coded English literals after
// `src/` is fixed; UI_ENGLISH_LITERALS below is the single place to extend when
// another UI string is localised (no if/else chain to touch).
// ---------------------------------------------------------------------------

const REQUIRED_COPY_LOCALES = ['en', 'zh-Hans', 'zh-Hant'];

/**
 * Known English literals that must not appear in a translated build's HTML.
 * `id` is a stable label for the failure detail; `literal` is the exact HTML
 * fragment to search for. ConsentGate strings are rendered during hydration
 * (JS bundle), so they are deliberately left to browser-check here.
 */
const UI_ENGLISH_LITERALS = [
  {id: 'wide-table.open.text', literal: '>Open table full width<'},
  {id: 'wide-table.open.aria', literal: 'aria-label="Open table full width"'},
  {id: 'wide-table.open.title', literal: 'title="Open table full width"'},
  {id: 'wide-table.modal.title', literal: 'data-modal-title="Table View"'},
  {id: 'wide-table.modal.close', literal: 'data-modal-close="Close"'},
  {id: 'arg-row.mandatory', literal: '( mandatory )'},
  // ArgTable: use the exact fragment rendered by the component's COPY fallback.
  // Bare `>Argument<` / `>Type<` / `>Description<` also match English technical
  // terms that legitimately stay English inside translated CLI/hardware pages
  // (e.g. `<th>Type</th>` in a hardware spec table), which would keep the gate
  // red forever; the full fragment can only come from the component's en copy.
  {id: 'arg-table.headers', literal: '<table class="styled_table"><thead><tr><th width="20%">Argument</th><th>Type</th><th>Description</th>'},
  {id: 'correction.aria', literal: 'aria-label="Official-defect correction"'},
  {id: 'correction.title', literal: 'title="Official-defect correction"'},
];

function walkExt(dir, re, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkExt(full, re, out);
    else if (re.test(entry.name)) out.push(full);
  }
  return out;
}

/** Index of the `}` matching the `{` at `open`, skipping strings and comments. */
function matchingBrace(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '/' && text[i + 1] === '/') {
      const eol = text.indexOf('\n', i);
      i = eol === -1 ? text.length : eol;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Top-level keys of an object-literal body, ignoring nested objects/values. */
function topLevelKeys(body) {
  const keys = new Set();
  let depth = 0;
  let token = '';
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === '\\') { token += body[++i] ?? ''; continue; }
      if (ch === quote) { quote = null; continue; }
      token += ch;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '/' && body[i + 1] === '/') {
      const eol = body.indexOf('\n', i);
      i = eol === -1 ? body.length : eol;
      token = '';
      continue;
    }
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2);
      i = end === -1 ? body.length : end + 1;
      token = '';
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; token = ''; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; token = ''; continue; }
    if (depth === 0 && ch === ':') {
      const key = token.trim();
      if (key) keys.add(key);
      token = '';
      continue;
    }
    if (/[\s,]/.test(ch)) { token = ''; continue; }
    token += ch;
  }
  return keys;
}

// (a) Every `const COPY` in src/**/*.tsx must be trilingual. Scanning the whole
// tree (rather than a hand-maintained component list) means a newly added
// component is covered as soon as it introduces a COPY map.
const srcDir = path.join(REPO, 'src');
const tsxFiles = walkExt(srcDir, /\.tsx$/);
let copyObjects = 0;
const copyMissing = [];
for (const file of tsxFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bconst\s+COPY\b\s*(?::[^=]+)?=\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    const close = matchingBrace(text, open);
    if (close < 0) continue;
    copyObjects++;
    const keys = topLevelKeys(text.slice(open + 1, close));
    const missing = REQUIRED_COPY_LOCALES.filter((locale) => !keys.has(locale));
    if (missing.length) {
      copyMissing.push(`${relative(REPO, file)}: missing ${missing.join(',')} (found ${[...keys].join(',')})`);
    }
  }
}
details.uiCopySrc = {files: tsxFiles.length, copyObjects, missing: copyMissing.length};
if (copyMissing.length) {
  failures.push(`uiCopySrc: ${copyMissing.length} COPY map(s) missing ${REQUIRED_COPY_LOCALES.join('/')}: ${copyMissing.slice(0, 3).join('; ')}`);
}

// (b) A translated build's HTML must not contain the known English literals.
// Locale resolution: explicit `SITE_LOCALE` wins. Otherwise the build's own
// `<meta name="docusaurus-site-locale">` is authoritative — the hub builds
// English into `build/` while `DEFAULT_TARGET_LOCALE` still names the zh-Hans
// overlay (paths.mjs), so applying that constant to the hub's single-locale
// artifact checked an English build as if it were Chinese and produced 3387
// false positives. A multi-locale build is recognised by its `build/<locale>/`
// subtree. Only a genuinely translated build is scanned; `en` and an
// unresolved template placeholder (`zh-Hans`) are skipped.
// `LABELS_BUILD_DIR` points this build-face check at rehearsal artifacts; the
// default is the repository's own build/ tree.
const buildDir = path.resolve(process.env.LABELS_BUILD_DIR || path.join(REPO, 'build'));
const envLocale = (process.env.SITE_LOCALE || '').trim();
const repoLocale = /\{\{|\}\}/.test(DEFAULT_TARGET_LOCALE) ? '' : DEFAULT_TARGET_LOCALE;

/** Locale the produced HTML declares for itself (single-locale build). */
function buildLocaleFromHtml(file) {
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const tag = /<meta\b[^>]*\bname=["']docusaurus-site-locale["'][^>]*>/i.exec(html)?.[0];
  const content = tag && /\bcontent=["']([^"']+)["']/i.exec(tag);
  return content ? content[1] : null;
}

const localeSubtree =
  repoLocale && fs.existsSync(path.join(buildDir, repoLocale)) ? repoLocale : null;
const uiLocale =
  envLocale ||
  localeSubtree ||
  buildLocaleFromHtml(path.join(buildDir, 'index.html')) ||
  repoLocale ||
  '';
const skipUiBuild = !uiLocale || uiLocale === 'en';
if (skipUiBuild) {
  details.uiCopyBuild = {locale: uiLocale || null, skipped: 'en-or-unknown-locale', files: 0, hits: 0};
} else {
  const localeDir = path.join(buildDir, uiLocale);
  // Single-locale builds write to build/ itself; multi-locale builds write to
  // build/<locale>/. Scan only the matching locale and never the English root.
  const roots = fs.existsSync(localeDir) ? [localeDir] : [buildDir];
  const htmlFiles = roots.flatMap((root) => walkExt(root, /\.html$/));
  const byLiteral = {};
  const samples = [];
  let hits = 0;
  for (const file of htmlFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const {id, literal} of UI_ENGLISH_LITERALS) {
      let from = 0;
      let found;
      while ((found = text.indexOf(literal, from)) !== -1) {
        hits++;
        byLiteral[id] = (byLiteral[id] || 0) + 1;
        if (samples.length < 3) samples.push(`${relative(buildDir, file)}: ${literal}`);
        from = found + literal.length;
      }
    }
  }
  details.uiCopyBuild = {
    locale: uiLocale,
    roots: roots.map((root) => relative(REPO, root)),
    files: htmlFiles.length,
    hits,
    byLiteral,
    samples,
  };
  if (hits) {
    const breakdown = Object.entries(byLiteral).map(([id, n]) => `${id}=${n}`).join(', ');
    failures.push(`uiCopyBuild: ${hits} hardcoded English UI literal(s) in ${uiLocale} build HTML (${breakdown}); e.g. ${samples.slice(0, 3).join('; ')}`);
  }

  // (c) Next/Previous labels in built HTML. A page whose *target* has a
  // translated title but whose card reads English is the exact 7.24/7.25
  // regression: the English source had no `sidebar_label`, so Docusaurus used
  // the English sidebar item instead of the Chinese title. CLI pages are
  // excluded by policy (a translated command cannot be typed).
  const isEnglishProse = (text) =>
    /[a-z]/.test(text) && (/[A-Z]/.test(text) || /\s/.test(text)) && !CJK.test(text);
  const overlayRootForRoute = (version, route) => {
    const slot = version === docsCurrentVersion ? 'current' : `version-${version}`;
    const base = path.join(REPO, localeRoot(DEFAULT_TARGET_LOCALE), 'docusaurus-plugin-content-docs', slot);
    return [`${route}.md`, `${route}/index.md`, 'index.md']
      .map((candidate) => path.join(base, candidate))
      .find((file) => fs.existsSync(file)) || null;
  };
  const pagination = {
    versions: {}, checked: 0, english: 0, cliPages: 0, untranslatedTargets: 0, samples: [],
  };
  for (const root of roots) {
    for (const file of walkExt(path.join(root, 'docs'), /\.html$/)) {
      const rel = relative(root, file).split(path.sep).join('/');
      const match = /^docs\/(?:(\d+\.\d+)\/)?(.*)\/index\.html$/.exec(rel);
      if (!match) continue;
      const version = match[1] || docsCurrentVersion;
      const route = match[2];
      if (route.startsWith('cli-reference/')) {
        pagination.cliPages++;
        continue;
      }
      const html = fs.readFileSync(file, 'utf8');
      const cards = [...html.matchAll(
        /<a\b[^>]*class="pagination-nav__link[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]{0,800}?<div class="pagination-nav__label">([^<]*)<\/div>/g,
      )];
      pagination.versions[version] = (pagination.versions[version] || 0) + cards.length;
      for (const [, href, rawLabel] of cards) {
        const label = rawLabel.trim();
        pagination.checked++;
        if (!isEnglishProse(label)) continue;
        const target = /\/docs(?:\/(\d+\.\d+))?\/([^?#]*)/.exec(decodeURIComponent(href));
        if (!target) continue;
        const targetVersion = target[1] || docsCurrentVersion;
        const targetRoute = target[2].replace(/\/+$/, '').replace(/\/index$/, '') || 'index';
        const overlayFile = overlayRootForRoute(targetVersion, targetRoute);
        if (!overlayFile) continue;
        const title = readField(
          splitFrontMatter(fs.readFileSync(overlayFile, 'utf8')).frontMatter,
          'title',
        ) || '';
        // An untranslated target legitimately shows its English title/label.
        if (!CJK.test(title)) {
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
  if (pagination.english) {
    failures.push(
      `paginationBuild: ${pagination.english} Chinese page(s) with an English Next/Previous label, e.g. ${pagination.samples.slice(0, 3).join('; ')}`,
    );
  }
}

for (const [name, value] of Object.entries(details)) {
  console.log(`  ${failures.some((line) => line.startsWith(name)) ? 'FAIL' : 'ok  '} ${name}: ${JSON.stringify(value)}`);
}
if (failures.length) {
  for (const line of failures) console.log(`FAIL ${line}`);
  process.exitCode = 1;
}
