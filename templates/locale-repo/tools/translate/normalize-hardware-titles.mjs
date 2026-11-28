#!/usr/bin/env node
/**
 * Hardware Guides: product names stay English, category pages stay Chinese.
 *
 * The Hardware section is a catalogue of model names. A translated model
 * ("无线有线立方体", "小区间") is unrecognisable and cannot be searched, so the
 * title of a *model page* keeps the English wording; only a trailing "series" is
 * rendered as "系列", because that word *is* a category word. Which suffixes
 * count, and what they become, is policy: config/sidebar-labels.yml
 * (`hardware.title_suffix`), not a regex buried in this file.
 *
 * The landing page and any category page are the other half of the catalogue and
 * are *excluded*: their title is the section's own name ("Hardware Guides" ->
 * "硬件指南") or the Chinese category label from `hardware.categories`, never a
 * model name. Forcing English on them is what turned `/zh-Hans/hardware/` back
 * into "Hardware Guides". Their Chinese wording is not guessed here either: the
 * landing title is pinned in `config/translation-patches/zh-Hans/hardware/
 * index.md.yml` and the category labels live in `config/sidebar-labels.yml`.
 *
 * The canonical value is written back to the title memory, so `apply` produces it
 * directly instead of asking the model again.
 *
 * Page-level exclusions win over this pass. `config/translation-exclusions.yml`
 * keeps whole pages (e.g. the official multilingual Quick Guides) in the English
 * source bytes, and a title rewrite here would be the one thing that puts CJK
 * back on such a page. The shared `isTranslationExcluded(section, rel)` predicate
 * from `lib/apply.mjs` is used; if that module cannot be imported safely, the
 * same config-driven rule is applied inline (see below). The guard is deliberately
 * ahead of every title/memory write, so an excluded page is left byte-identical.
 *
 *   node tools/translate/normalize-hardware-titles.mjs            # report
 *   node tools/translate/normalize-hardware-titles.mjs --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {SECTIONS, REPO, walkMarkdown, relative} from './lib/paths.mjs';
import {splitFrontMatter, readField} from './lib/frontmatter.mjs';
import {loadModelMemory, saveModelMemory} from './lib/model-memory.mjs';

const LABELS_CONFIG = path.join(REPO, 'config/sidebar-labels.yml');
const EXCLUSIONS_CONFIG = path.join(REPO, 'config/translation-exclusions.yml');
const DEFAULT_SUFFIX = {from: ['series', '-series', '–series'], to: '系列'};

let suffixCache = null;

/**
 * Inline copy of the page-level exclusion rule in `lib/apply.mjs`.
 *
 * The planner and `apply` already skip these pages. This is only the fallback
 * for the case where importing `lib/apply.mjs` is not safe in this context (a
 * stripped toolchain, a broken transitive import, ...): the guard must never
 * silently disappear just because a dependency could not be loaded. The rule is
 * identical — source path prefix and/or an overlay path segment prefix, with an
 * optional section filter — and nothing is hardcoded to a product slug.
 */
function inlineIsTranslationExcluded(section, rel) {
  if (!fs.existsSync(EXCLUSIONS_CONFIG)) return false;
  let rows = [];
  try {
    const parsed = YAML.parse(fs.readFileSync(EXCLUSIONS_CONFIG, 'utf8')) || {};
    rows = Array.isArray(parsed.exclusions) ? parsed.exclusions : [];
  } catch {
    // A malformed exclusion config must not turn into "rewrite every title".
    // Fail safe: treat every page as excluded rather than lose the guard.
    return true;
  }
  const sourceRel = `${section.source}/${rel}`.split(path.sep).join('/');
  const segments = String(rel)
    .split(/[\\/]/)
    .map((part) => part.replace(/\.mdx?$/i, ''));
  return rows.some((rule) => {
    if (rule.section && rule.section !== section.name) return false;
    if ((rule.source_prefixes || []).some((prefix) => sourceRel.startsWith(String(prefix)))) {
      return true;
    }
    return (rule.overlay_segment_prefixes || []).some((prefix) =>
      segments.some((segment) => segment.startsWith(String(prefix))),
    );
  });
}

/**
 * The exclusion predicate used by this pass, resolved once at load time.
 * Exported so the pure-function probe can assert "quick-guide page => no
 * rewrite, ordinary hardware page => unchanged behaviour" without a batch.
 */
export const isTitlePassExcluded = await (async () => {
  try {
    const shared = await import('./lib/apply.mjs');
    if (typeof shared.isTranslationExcluded === 'function') return shared.isTranslationExcluded;
  } catch {
    // Fall back to the inline rule below; never skip the guard.
  }
  return inlineIsTranslationExcluded;
})();

function hardwarePolicy() {
  if (!fs.existsSync(LABELS_CONFIG)) return {};
  const parsed = YAML.parse(fs.readFileSync(LABELS_CONFIG, 'utf8')) || {};
  return parsed.hardware || {};
}

/**
 * `hardware.title_suffix` from config/sidebar-labels.yml. The fallback keeps the
 * old behaviour when the file or the key is missing, so this pass can never
 * start translating model names by accident.
 */
export function titleSuffixPolicy() {
  if (suffixCache) return suffixCache;
  let suffix = DEFAULT_SUFFIX;
  const configured = hardwarePolicy().title_suffix;
  if (configured && Array.isArray(configured.from) && configured.from.length && configured.to) {
    suffix = {from: configured.from.map(String), to: String(configured.to)};
  }
  // Longest suffix wins: "-series" must be tried before "series" so the hyphen
  // is not left dangling in front of the translated word.
  suffixCache = {
    from: [...suffix.from].sort((a, b) => b.length - a.length),
    to: suffix.to,
  };
  return suffixCache;
}

/** English hardware title -> Chinese title (only the trailing series word moves). */
export function hardwareTitle(english) {
  const text = String(english || '').trim();
  const {from, to} = titleSuffixPolicy();
  const lower = text.toLowerCase();
  for (const needle of from) {
    if (!needle || !lower.endsWith(needle.toLowerCase())) continue;
    // "mANT-series" and "hAP series" are the same word: the suffix is a category.
    const head = text.slice(0, text.length - needle.length).replace(/[\s\-–—]+$/, '');
    if (!head) return text;
    return `${head} ${to}`;
  }
  return text;
}

/** English category labels (`Switches`, `60 GHz products`) -> Chinese. */
export function categoryLabels() {
  const categories = hardwarePolicy().categories;
  return categories && typeof categories === 'object' ? categories : {};
}

/**
 * Is this overlay page a landing / category page instead of a model page?
 *
 * Three shapes count, because the official export uses all of them: the section
 * landing page itself (`hardware/index.md`), a page that pins itself to a
 * category root with `slug: /`, and a page whose sidebar label *is* one of the
 * configured category labels. Everything else in the tree is a model.
 */
export function isCategoryPage(rel, frontMatter) {
  const posix = String(rel || '').replace(/\\/g, '/');
  if (posix === 'index.md' || posix.endsWith('/index.md')) {
    // `foo/index.md` is a category landing page only when a category is named
    // `foo`; a nested `index.md` inside a model folder is not in this section.
    if (posix === 'index.md') return true;
    const dir = posix.slice(0, posix.length - '/index.md'.length);
    return Object.keys(categoryLabels()).some((label) => slugify(label) === dir.split('/').pop());
  }
  const slug = readField(frontMatter, 'slug');
  if (slug !== null && String(slug).trim() === '/') return true;
  const label = readField(frontMatter, 'sidebar_label');
  return Boolean(label && Object.hasOwn(categoryLabels(), String(label).trim()));
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function main() {
  const APPLY = process.argv.includes('--apply');
  const model = loadModelMemory();
  const section = SECTIONS.find((entry) => entry.name === 'hardware');
  let changed = 0;
  // Counted, not reported by page: these are the pages the rules must not touch.
  let categoryPages = 0;
  let excludedPages = 0;
  const samples = [];

  if (section && fs.existsSync(path.join(REPO, section.overlay))) {
    const sourceBase = path.join(REPO, section.source);
    const overlayBase = path.join(REPO, section.overlay);
    for (const file of walkMarkdown(overlayBase)) {
      const rel = relative(overlayBase, file);
      // Whole-page translation exclusions (Quick Guides and anything else in
      // config/translation-exclusions.yml) must stay in the English source
      // bytes. Without this guard this POST stage independently rewrites their
      // titles and reintroduces CJK that the planner deliberately left out.
      if (isTitlePassExcluded(section, rel)) {
        excludedPages++;
        continue;
      }
      const sourceFile = path.join(sourceBase, rel);
      if (!fs.existsSync(sourceFile)) continue;
      const sourceFm = splitFrontMatter(fs.readFileSync(sourceFile, 'utf8')).frontMatter;
      const english = readField(sourceFm, 'title');
      if (!english) continue;
      const overlayText = fs.readFileSync(file, 'utf8');
      const overlay = splitFrontMatter(overlayText);
      const current = readField(overlay.frontMatter, 'title');
      const label = readField(overlay.frontMatter, 'sidebar_label');

      // Landing / category pages are not models: leave them (and the title
      // memory) alone, so a Chinese title set by the translation pipeline or a
      // page patch survives instead of being renamed back to English.
      if (isCategoryPage(rel, sourceFm)) {
        categoryPages++;
        continue;
      }

      const wanted = hardwareTitle(english);
      model.set(`title:${english}`, wanted);
      if (current === wanted && (label == null || label === wanted)) continue;
      changed++;
      if (samples.length < 6) samples.push(`${current} → ${wanted}`);
      if (!APPLY) continue;
      writeTitle(file, overlayText, wanted, label != null);
    }
  }

  if (APPLY) saveModelMemory(model);
  console.log(
    JSON.stringify({apply: APPLY, titles: changed, categoryPages, excludedPages, samples}),
  );
}

/** Rewrite `title`/`sidebar_label` in place, keeping every other line intact. */
function writeTitle(file, overlayText, wanted, hasLabel) {
  let next = overlayText.replace(/^title:\s*.*$/m, `title: ${JSON.stringify(wanted)}`);
  if (hasLabel) {
    next = next.replace(/^sidebar_label:\s*.*$/m, `sidebar_label: ${JSON.stringify(wanted)}`);
  }
  fs.writeFileSync(file, next);
}

// Importing this module must not run the pass or print a second JSON line.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
