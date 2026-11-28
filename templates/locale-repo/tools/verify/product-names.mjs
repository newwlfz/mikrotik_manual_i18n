#!/usr/bin/env node
/**
 * `npm run verify:product-names` — independent product-name assertion.
 *
 * A hardware model is an identifier, not prose. This gate pairs every locale
 * hardware overlay with its English source and checks the places a previous
 * LLM run actually corrupted: front matter `title` / `sidebar_label`, the H1/H2
 * lines, and the hardware sidebar catalogue. When the English value contains a
 * configured model but the translated value dropped that model in favour of
 * Chinese (`Audience -> 受众`, `hAP be³ Media -> hAP be³ 媒体`), the page is an
 * offender. It reads no threshold, changes no file, makes no network call and
 * exits 1 as soon as any offender is found.
 *
 * The model list is derived from configuration, not hardcoded:
 *   - `config/glossary/<locale>.yml` terms with `source === target` and
 *     `kind: model` are the authoritative model names;
 *   - `config/technical-headings.yml#model_prefixes` / `keep_exact` are read as
 *     supporting policy (they feed the prompt/planner/TM guards) and printed in
 *     the summary so a missing config is not silently treated as "no models".
 *
 * Usage: node tools/verify/product-names.mjs [--locale=zh-Hans] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CJK = /[\u4e00-\u9fff]/;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const HEADING = /^(\s{0,3}#{1,2})[ \t]+(.+?)\s*$/;

const argv = process.argv.slice(2);
const locale =
  argv.find((arg) => arg.startsWith('--locale='))?.slice('--locale='.length) || 'zh-Hans';
const asJson = argv.includes('--json');

function readYaml(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8')) || null;
  } catch {
    return null;
  }
}

/** Model names (canonical spelling) from the locale glossary. */
function loadModels() {
  const parsed = readYaml(path.join(REPO, 'config/glossary', `${locale}.yml`));
  const terms = Array.isArray(parsed?.terms) ? parsed.terms : [];
  const models = new Set();
  for (const term of terms) {
    const source = String(term?.source ?? '').trim();
    const target = String(term?.target ?? '').trim();
    if (source && source === target && term?.kind === 'model') models.add(source);
  }
  return [...models];
}

/** Supporting policy counts, so an empty configuration is visible in the report. */
function loadPolicy() {
  const data = readYaml(path.join(REPO, 'config/technical-headings.yml'));
  return {
    keepExact: Array.isArray(data?.keep_exact) ? data.keep_exact.length : 0,
    modelPrefixes: Array.isArray(data?.model_prefixes) ? data.model_prefixes.length : 0,
  };
}

/**
 * Whole-page translation exclusions from config/translation-exclusions.yml.
 *
 * Config-driven, never slug-driven: a page is excluded when its repo-relative
 * source path starts with a configured prefix or one of its overlay path
 * segments starts with a configured segment prefix. The rule also declares the
 * category labels that must stay translated.
 */
function loadExclusions() {
  const data = readYaml(path.join(REPO, 'config/translation-exclusions.yml'));
  const rules = Array.isArray(data?.exclusions) ? data.exclusions : [];
  return rules.map((rule) => ({
    id: String(rule.id || 'unnamed'),
    section: rule.section ? String(rule.section) : null,
    sourcePrefixes: (rule.source_prefixes || []).map(String),
    segmentPrefixes: (rule.overlay_segment_prefixes || []).map(String),
    preservedLabels: (rule.preserved_labels || []).map((label) => ({
      key: String(label.key || ''),
      expected: String(label.expected || ''),
    })),
  }));
}

/** The exclusion rule matching one page, or null. `rel` is overlay-relative. */
function exclusionFor(exclusions, sectionName, sourceRel, rel) {
  const sourcePath = `${sectionName}/${rel}`;
  const segments = String(sourceRel).split('/').map((part) => part.replace(/\.mdx?$/i, ''));
  return (
    exclusions.find((rule) => {
      if (rule.section && rule.section !== sectionName) return false;
      if (rule.sourcePrefixes.some((prefix) => sourcePath.startsWith(prefix))) return true;
      return rule.segmentPrefixes.some((prefix) =>
        segments.some((segment) => segment.startsWith(prefix)),
      );
    }) || null
  );
}

/** CJK characters only; the ratio is taken over non-whitespace characters. */
function cjk(text) {
  return [...String(text ?? '')].filter((char) => CJK.test(char)).length;
}

function cjkRatio(text) {
  const chars = [...String(text ?? '')].filter((char) => /\S/.test(char));
  return chars.length ? cjk(text) / chars.length : 0;
}

function splitDocument(text) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return {frontMatter: '', body: text};
  return {frontMatter: match[1], body: text.slice(match[0].length)};
}

/**
 * A preserved category label must be a real translation: present, and not just
 * the English key echoed back. Any writing system is accepted so the same gate
 * works for non-Han locales; an empty value or the bare key is still a defect.
 */
function isTranslatedLabel(value, key) {
  const text = String(value ?? '').trim();
  return Boolean(text) && text !== String(key ?? '').trim();
}

function frontMatterField(frontMatter, name) {
  const match = new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(frontMatter);
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '') || null;
}

/** H1/H2 lines of a body, without their anchor suffix. */
function headings(body) {
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const match = HEADING.exec(line);
    if (match) out.push(match[2].replace(/\s*\{#[^}]*\}\s*$/, ''));
  }
  return out;
}

/**
 * Text with the non-prose parts removed: heading anchors, link destinations and
 * brackets. Without this an unchanged `{#audience-...}` anchor would make a
 * corrupted `## [受众](...)` look as though it still contained "Audience".
 */
function normalise(text) {
  return String(text ?? '')
    .replace(/\{#[^}]*\}/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
    .replace(/[\[\]()#]/g, ' ')
    .toLowerCase();
}

/** A model is a token, so "Cube" must not match "cubic". */
function containsModel(text, model) {
  const needle = model.toLowerCase();
  return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`).test(
    normalise(text),
  );
}

/** Models in the English value that are not substrings of a longer match. */
function modelsIn(text, models) {
  const found = models.filter((model) => containsModel(text, model));
  return found.filter(
    (model) =>
      !found.some((other) => other !== model && other.toLowerCase().includes(model.toLowerCase())),
  );
}

/** One paired value: which configured models did the translation drop? */
function lostModels(english, translated, models) {
  if (!english || !translated || !CJK.test(String(translated))) return [];
  return modelsIn(english, models).filter(
    (model) => !containsModel(translated, model),
  );
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  const models = loadModels();
  const policy = loadPolicy();
  const exclusions = loadExclusions();
  const sourceBase = path.join(REPO, 'hardware');
  const overlayBase = path.join(
    REPO,
    'i18n',
    locale,
    'docusaurus-plugin-content-docs-hardware',
    'current',
  );
  const offenders = [];
  let files = 0;
  let checks = 0;
  const excluded = {pages: 0, identicalBodies: 0, cjkAdded: 0, provenanceMissing: 0, translatedFields: 0};
  const labelChecks = [];

  for (const overlayPath of walk(overlayBase)) {
    const rel = path.relative(overlayBase, overlayPath).split(path.sep).join('/');
    const sourcePath = path.join(sourceBase, rel);
    if (!fs.existsSync(sourcePath)) continue;
    files++;
    const source = splitDocument(fs.readFileSync(sourcePath, 'utf8'));
    const overlay = splitDocument(fs.readFileSync(overlayPath, 'utf8'));

    // Excluded pages must be English: no added CJK, no translated metadata,
    // provenance preserved. They are not product-name checks — their whole
    // purpose is to stay byte-for-byte English.
    const rule = exclusionFor(exclusions, 'hardware', rel, rel);
    if (rule) {
      excluded.pages++;
      if (overlay.body === source.body) excluded.identicalBodies++;
      const sourceCjk = cjk(source.body);
      const overlayCjk = cjk(overlay.body);
      // The English source itself carries the official multilingual sections
      // (including PRC - 中文), so its CJK count is the baseline, not zero.
      if (overlayCjk > sourceCjk) {
        excluded.cjkAdded++;
        offenders.push({
          file: rel,
          field: 'excluded.page.body',
          rule: rule.id,
          english: `cjk=${sourceCjk} ratio=${cjkRatio(source.body).toFixed(4)}`,
          translated: `cjk=${overlayCjk} ratio=${cjkRatio(overlay.body).toFixed(4)}`,
        });
      }
      for (const key of ['source', 'captured_at']) {
        // The restored overlay must carry the source provenance even when the
        // English source itself has the field.
        if (!frontMatterField(overlay.frontMatter, key)) {
          excluded.provenanceMissing++;
          offenders.push({file: rel, field: `excluded.frontmatter.${key}`, rule: rule.id});
        }
      }
      for (const field of ['title', 'sidebar_label', 'description']) {
        const value = frontMatterField(overlay.frontMatter, field);
        if (value && CJK.test(value)) {
          excluded.translatedFields++;
          offenders.push({file: rel, field: `excluded.frontmatter.${field}`, rule: rule.id, translated: value});
        }
      }
      continue;
    }

    for (const field of ['title', 'sidebar_label']) {
      const english = frontMatterField(source.frontMatter, field);
      const translated = frontMatterField(overlay.frontMatter, field);
      if (!english || !translated) continue;
      checks++;
      for (const model of lostModels(english, translated, models)) {
        offenders.push({file: rel, field: `frontmatter.${field}`, model, english, translated});
      }
    }

    const sourceHeadings = headings(source.body);
    const overlayHeadings = headings(overlay.body);
    for (let index = 0; index < Math.min(sourceHeadings.length, overlayHeadings.length); index++) {
      checks++;
      for (const model of lostModels(sourceHeadings[index], overlayHeadings[index], models)) {
        offenders.push({
          file: rel,
          field: index === 0 ? 'H1' : 'H2',
          model,
          english: sourceHeadings[index],
          translated: overlayHeadings[index],
        });
      }
    }
  }

  // The hardware sidebar catalogue is another place the model can be rewritten.
  const catalogue = path.join(
    REPO,
    'i18n',
    locale,
    'docusaurus-plugin-content-docs-hardware',
    'current.json',
  );
  if (fs.existsSync(catalogue)) {
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(catalogue, 'utf8'));
    } catch {
      entries = null;
    }
    for (const [key, value] of Object.entries(entries || {})) {
      const prefix = 'sidebar.hardware.category.';
      if (!key.startsWith(prefix)) continue;
      const english = key.slice(prefix.length);
      const translated = value?.message;
      if (!translated) continue;
      checks++;
      for (const model of lostModels(english, translated, models)) {
        offenders.push({file: 'current.json', field: 'sidebar', model, english, translated});
      }
    }
  }

  // Excluded pages are not the only thing that must survive the rule: a
  // category name is a catalogue label, not a page, and must stay translated in
  // whatever script the locale uses. Read the declared label from
  // sidebar-labels.yml and, when materialized, from the locale catalogue.
  // A repository that has not received the D-phase
  // hardware structure yet has no such label and is reported, not failed.
  const sidebarPolicy = readYaml(path.join(REPO, 'config/sidebar-labels.yml')) || {};
  let catalogueEntries = null;
  if (fs.existsSync(catalogue)) {
    try {
      catalogueEntries = JSON.parse(fs.readFileSync(catalogue, 'utf8'));
    } catch {
      catalogueEntries = null;
    }
  }
  for (const rule of exclusions) {
    for (const label of rule.preservedLabels) {
      if (!label.key) continue;
      const fromPolicy = sidebarPolicy?.hardware?.categories?.[label.key] ?? null;
      const fromCatalogue = catalogueEntries?.[`sidebar.hardware.category.${label.key}`]?.message ?? null;
      const status = fromPolicy || fromCatalogue
        ? `policy=${JSON.stringify(fromPolicy)} catalogue=${JSON.stringify(fromCatalogue)}`
        : 'not-materialized (D-phase hardware structure not pushed yet)';
      labelChecks.push({rule: rule.id, key: label.key, expected: label.expected, status});
      // The exclusion rule itself must declare a translated category name: the
      // whole point is that only pages are excluded, not catalogue labels.
      // Any script counts as translated; empty or the bare English key does not.
      checks++;
      if (!isTranslatedLabel(label.expected, label.key)) {
        offenders.push({file: 'config/translation-exclusions.yml', field: `label.${label.key}`, translated: label.expected});
      }
      for (const value of [fromPolicy, fromCatalogue]) {
        if (!value) continue;
        checks++;
        if (value !== label.expected || !isTranslatedLabel(value, label.key)) {
          offenders.push({file: 'sidebar', field: `label.${label.key}`, english: label.key, translated: value});
        }
      }
    }
  }
  // A config with no matching page is only a defect once the repo actually has
  // hardware overlays: a freshly scaffolded locale repo has no content yet.
  if (exclusions.length > 0 && excluded.pages === 0 && files > 0) {
    offenders.push({file: 'config/translation-exclusions.yml', field: 'no-pages-matched'});
  }

  const summary = {
    locale,
    models,
    policy,
    files,
    checks,
    exclusions: exclusions.map((rule) => rule.id),
    excluded,
    labels: labelChecks,
    offenders: offenders.length,
    pages: new Set(offenders.map((item) => item.file)).size,
  };
  if (asJson) {
    process.stdout.write(`${JSON.stringify({...summary, details: offenders})}\n`);
  } else {
    process.stdout.write(
      `verify:product-names locale=${locale} models=${models.length} ` +
        `keep_exact=${policy.keepExact} model_prefixes=${policy.modelPrefixes} ` +
        `files=${files} checks=${checks} offenders=${offenders.length} pages=${summary.pages}\n`,
    );
    process.stdout.write(
      `verify:exclusions rules=${exclusions.length} pages=${excluded.pages} ` +
        `identical_bodies=${excluded.identicalBodies} cjk_added=${excluded.cjkAdded} ` +
        `provenance_missing=${excluded.provenanceMissing} translated_fields=${excluded.translatedFields}\n`,
    );
    for (const item of labelChecks) {
      process.stdout.write(`  label ${item.key}: ${item.status}\n`);
    }
    for (const item of offenders) {
      process.stdout.write(
        `  ${item.file} ${item.field}: "${item.model}" lost: ` +
          `${JSON.stringify(item.english)} -> ${JSON.stringify(item.translated)}\n`,
      );
    }
  }
  if (models.length === 0) {
    process.stderr.write(
      `verify:product-names: config/glossary/${locale}.yml has no kind:model terms; ` +
        'the gate cannot detect anything — refusing to pass\n',
    );
    process.exitCode = 1;
    return;
  }
  if (offenders.length > 0) process.exitCode = 1;
}

main();
