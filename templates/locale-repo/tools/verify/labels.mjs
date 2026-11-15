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
import YAML from 'yaml';
import {SECTIONS, REPO, walkMarkdown, relative} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {canonicalTitle} from '../translate/normalize-titles.mjs';
import {hardwareTitle, titleSuffixPolicy} from '../translate/normalize-hardware-titles.mjs';
import {deprecatedNewsletterTerms} from '../translate/normalize-newsletter.mjs';
import {
  COMPARE_VERSIONS,
  compareVersionLabels,
} from '../translate/normalize-cli-headers.mjs';

const CJK = /[\u4e00-\u9fff]/;
const failures = [];
const details = {};

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
  const file = path.join(REPO, 'config/glossary/zh-Hans.yml');
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
    const englishLabel = readField(splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter, 'sidebar_label');
    if (!englishLabel) continue;
    checked++;
    const overlayFm = splitFrontMatter(fs.readFileSync(file, 'utf8')).frontMatter;
    const zhTitle = readField(overlayFm, 'title') || '';
    const zhLabel = readField(overlayFm, 'sidebar_label');
    // The failure this guards against is the English label being copied verbatim
    // into the Chinese overlay (it wins over the translated sidebar catalogue).
    // A short acronym ("HTB") or a missing label (Docusaurus falls back to the
    // Chinese title) is fine.
    if (!CJK.test(zhTitle) || !zhLabel || zhLabel !== englishLabel) continue;
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
const hardwarePolicy = readYaml('config/sidebar-labels.yml')?.hardware || {};
const policyCategories = hardwarePolicy.categories || {};
const keepEnglish = new Set(hardwarePolicy.keep_english || []);
const suffix = titleSuffixPolicy();
const hardwareDetails = {};

const hardwareFile = path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current.json');
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

const hardwareOverlay = path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current');
if (fs.existsSync(hardwareOverlay)) {
  const sourceBase = path.join(REPO, 'hardware');
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

// PDF attachments: the export lost the content hash, so a link is only valid if
// the cached file exists under static/.
const pdfMissing = [];
for (const dir of ['hardware', 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current']) {
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
    const wanted = english ? canonicalTitle(english) : null;
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
// Chinese. The interactive widget's own field labels live in
// `src/components/CliCompare` and are not part of an overlay.
const compareLabels = compareVersionLabels();
let compareChecked = 0;
const compareRemaining = [];
for (const section of SECTIONS.filter((entry) => /^docs/.test(entry.name))) {
  const file = path.join(REPO, section.overlay, 'cli-reference', COMPARE_VERSIONS);
  if (!fs.existsSync(file)) continue;
  compareChecked++;
  const body = splitFrontMatter(fs.readFileSync(file, 'utf8')).body;
  for (const match of body.matchAll(/(\*\*|\*)([^*\n]+?)\1/g)) {
    const inner = match[2].trim();
    const hit = compareLabels.get(inner.toLowerCase());
    if (hit && hit.chinese !== inner) compareRemaining.push(`${section.name}: ${match[0]}`);
  }
}
details.compareVersions = {checked: compareChecked, englishLabels: compareRemaining.length};
if (compareRemaining.length) {
  failures.push(
    `compare-versions: ${compareRemaining.length} label(s) still English: ${compareRemaining.slice(0, 3).join('; ')}`,
  );
}

for (const [name, value] of Object.entries(details)) {
  console.log(`  ${failures.some((line) => line.startsWith(name)) ? 'FAIL' : 'ok  '} ${name}: ${JSON.stringify(value)}`);
}
if (failures.length) {
  for (const line of failures) console.log(`FAIL ${line}`);
  process.exitCode = 1;
}
