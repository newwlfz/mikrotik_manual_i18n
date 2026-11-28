#!/usr/bin/env node
/**
 * `npm run verify:tag-rows` — anti-duplication gate for article tag rows.
 *
 * Product news (/blog) and Docs Changes (/changelog) render their tags twice
 * when the sync pipeline converts the official page's own `<p><strong>Tags:
 * </strong></p><ul>…` block into Markdown: turndown emits a `**Tags:**` header
 * plus tag links in the *body*, while Docusaurus renders the front-matter
 * `tags:` block as the native tag footer. This gate proves the body copy is
 * gone and the front-matter copy is the only one left.
 *
 * The label is locale-dependent: English builds render `<b>Tags:</b>`,
 * zh-Hans renders `<b>标签：</b>` and zh-Hant renders `<b>標籤：</b>`. The
 * expected text is read from this repository's own UI catalogue
 * `i18n/<locale>/code.json` (`theme.tags.tagsListLabel.message`), never
 * hardcoded. A repository without a catalogue (the English hub) falls back to
 * `Tags:`. All thresholds stay exactly as they were — only the literal is
 * derived per locale; a wrong-locale label still fails.
 *
 * Source face (always): every blog/*.md and changelog/*.md must have
 *   - zero `**<label>**` lines and zero `/…/tags/…` link rows in the body;
 *   - exactly one `tags:` block in the front matter.
 *
 * Build face (unless --data-only): for every article page with a built HTML
 * file, `<strong><label></strong>` must be 0, `<b><label></b>` must be 1 (the
 * native footer), and the number of `rel="tag"` links must equal the
 * front-matter tag count. Missing build pages are SKIPped, not failed, so the
 * source face still runs before a build exists. A stale build/ still carrying
 * the body copy is reported as a failure: rebuild after re-running the fetch
 * stages.
 *
 *   node tools/verify/tag-rows.mjs            # source + build faces
 *   node tools/verify/tag-rows.mjs --data-only # source face only
 *   node tools/verify/tag-rows.mjs --json
 *
 * No network, no .env.local, no target-content execution. Exit 0 only when
 * every checked page passes.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = ['blog', 'changelog'];
const DATA_ONLY = process.argv.includes('--data-only');
const JSON_OUT = process.argv.includes('--json');

const CATALOGUE_KEY = 'theme.tags.tagsListLabel';
const FALLBACK_LABEL = 'Tags:';

/** Locales that actually ship a UI catalogue in this repository. */
function catalogueLocales() {
  const root = path.join(REPO, 'i18n');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && !/\{\{|\}\}/.test(entry.name))
    .filter((entry) => fs.existsSync(path.join(root, entry.name, 'code.json')))
    .map((entry) => entry.name)
    .sort();
}

/** Locale declared by the built HTML itself, when a build is present. */
function buildMetaLocale() {
  const file = path.join(REPO, 'build', 'blog', 'index.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const tag = /<meta\b[^>]*\bname=["']docusaurus-site-locale["'][^>]*>/i.exec(html)?.[0];
  const content = tag && /\bcontent=["']([^"']+)["']/i.exec(tag);
  return content ? content[1] : null;
}

/**
 * Locale whose UI text is being verified. The catalogue is the authority:
 * `DEFAULT_TARGET_LOCALE` in paths.mjs is `zh-Hans` even in the English hub,
 * so it cannot decide which label an English build renders. `SITE_LOCALE`
 * picks among the catalogues that really exist; the build's own meta is a
 * secondary hint; a repo with no catalogue is English.
 */
function resolveUiLocale() {
  const available = catalogueLocales();
  if (available.length === 0) return {locale: 'en', source: 'no i18n catalogue'};
  const env = (process.env.SITE_LOCALE || '').trim();
  if (env && available.includes(env)) return {locale: env, source: 'SITE_LOCALE'};
  const meta = buildMetaLocale();
  if (meta && available.includes(meta)) return {locale: meta, source: 'build meta'};
  return {locale: available[0], source: 'i18n catalogue'};
}

const {locale: LOCALE, source: LOCALE_SOURCE} = resolveUiLocale();

function readCatalogueLabel(locale) {
  const file = path.join(REPO, 'i18n', locale, 'code.json');
  try {
    const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'));
    const message = catalogue?.[CATALOGUE_KEY]?.message;
    if (typeof message === 'string' && message.trim()) return {label: message.trim(), source: file};
  } catch {
    // Missing or unreadable catalogue: keep the historical English literal.
  }
  return {label: FALLBACK_LABEL, source: 'fallback (no catalogue entry)'};
}

const {label: LABEL, source: LABEL_SOURCE} = readCatalogueLabel(LOCALE);
const LABEL_SOURCE_DISPLAY = path.isAbsolute(LABEL_SOURCE) ? path.relative(REPO, LABEL_SOURCE) : LABEL_SOURCE;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const QUOTED_LABEL = escapeRegExp(LABEL);

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TAGS_BLOCK = /^tags\s*:/;
const BODY_TAG_HEADER = new RegExp(`^\\*\\*${QUOTED_LABEL}\\*\\*\\s*$`);
const BODY_TAG_ROW = /^\s*-\s+\[[^\]]+\]\([^)]*\/tags\/[^)]*\)/;
const STRONG_TAGS = new RegExp(`<strong>\\s*${QUOTED_LABEL}\\s*<\\/strong>`, 'gi');
const B_TAGS = new RegExp(`<b>\\s*${QUOTED_LABEL}\\s*<\\/b>`, 'gi');
const REL_TAG = /\brel\s*=\s*["']tag["']/gi;

function count(text, re) {
  re.lastIndex = 0;
  return (text.match(re) || []).length;
}

function listMarkdown(root) {
  const dir = path.join(REPO, root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({root, name, file: path.join(dir, name), rel: `${root}/${name}`}));
}

/** Number of `tags:` blocks and number of tag entries inside the first one. */
function frontMatterTags(lines) {
  const blocks = lines.filter((line) => TAGS_BLOCK.test(line)).length;
  const start = lines.findIndex((line) => TAGS_BLOCK.test(line));
  if (start < 0) return {blocks, entries: 0};
  let entries = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s/.test(line)) break; // first unindented line ends the tags block
    if (/^\s*-\s+\S/.test(line)) entries++;
  }
  return {blocks, entries};
}

function checkSource(page) {
  const text = fs.readFileSync(page.file, 'utf8');
  const match = FRONT_MATTER.exec(text);
  if (!match) return {...page, problems: ['no front matter'], tagEntries: 0};
  const lines = match[1].split(/\r?\n/);
  const body = text.slice(match[0].length);
  const bodyLines = body.split(/\r?\n/);
  const {blocks, entries} = frontMatterTags(lines);
  const headers = bodyLines.filter((line) => BODY_TAG_HEADER.test(line)).length;
  const rows = bodyLines.filter((line) => BODY_TAG_ROW.test(line)).length;
  const problems = [];
  if (blocks !== 1) problems.push(`frontmatter tags blocks=${blocks} (expected 1)`);
  if (headers !== 0) problems.push(`body '**${LABEL}**' lines=${headers} (expected 0)`);
  if (rows !== 0) problems.push(`body '/…/tags/…' link rows=${rows} (expected 0)`);
  return {rel: page.rel, root: page.root, tagEntries: entries, headers, rows, blocks, problems};
}

function checkBuild(page, tagEntries) {
  const slug = page.name.replace(/\.md$/, '');
  const htmlFile = path.join(REPO, 'build', page.root, slug, 'index.html');
  if (!fs.existsSync(htmlFile)) return {rel: page.rel, skipped: true, problems: []};
  const html = fs.readFileSync(htmlFile, 'utf8');
  const strong = count(html, STRONG_TAGS);
  const bold = count(html, B_TAGS);
  const relTag = count(html, REL_TAG);
  const problems = [];
  if (strong !== 0) problems.push(`<strong>${LABEL}</strong>=${strong} (expected 0)`);
  if (bold !== 1) problems.push(`<b>${LABEL}</b>=${bold} (expected 1)`);
  if (relTag !== tagEntries) problems.push(`rel=tag=${relTag} != frontmatter tags=${tagEntries}`);
  return {rel: `build/${page.root}/${slug}`, strong, bold, relTag, problems};
}

const sources = [...listMarkdown('blog'), ...listMarkdown('changelog')];
const sourceResults = sources.map(checkSource);
const buildResults = DATA_ONLY
  ? []
  : sources.map((page, i) => checkBuild(page, sourceResults[i].tagEntries));

const failures = [...sourceResults, ...buildResults].filter((result) => result.problems.length);
const built = buildResults.filter((result) => !result.skipped).length;

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        locale: LOCALE,
        label: LABEL,
        labelSource: LABEL_SOURCE,
        pages: sources.length,
        byRoot: Object.fromEntries(ROOTS.map((root) => [root, sources.filter((p) => p.root === root).length])),
        bodyHeaders: sourceResults.reduce((n, r) => n + (r.headers || 0), 0),
        bodyTagRows: sourceResults.reduce((n, r) => n + (r.rows || 0), 0),
        buildChecked: built,
        buildSkipped: buildResults.length - built,
        failures,
        ok: failures.length === 0,
      },
      null,
      2,
    ),
  );
} else {
  const byRoot = ROOTS.map((root) => `${sources.filter((p) => p.root === root).length} ${root}`).join(', ');
  console.log(`tag-rows: locale ${LOCALE} (${LOCALE_SOURCE}), label ${JSON.stringify(LABEL)} from ${LABEL_SOURCE_DISPLAY}`);
  console.log(`tag-rows: source ${sources.length} pages (${byRoot || 'none'})`);
  console.log(
    `tag-rows: body '**${LABEL}**' lines ${sourceResults.reduce((n, r) => n + (r.headers || 0), 0)}` +
      `, body tag rows ${sourceResults.reduce((n, r) => n + (r.rows || 0), 0)}` +
      `, frontmatter 'tags:' blocks ${sourceResults.reduce((n, r) => n + (r.blocks || 0), 0)}`,
  );
  if (DATA_ONLY) {
    console.log('tag-rows: build face SKIPped (--data-only)');
  } else {
    console.log(`tag-rows: build ${built} pages checked, ${buildResults.length - built} skipped (no HTML)`);
  }
  if (failures.length) {
    console.log('tag-rows: FAIL');
    for (const result of failures) console.log(`  ${result.rel}: ${result.problems.join('; ')}`);
  } else {
    console.log('tag-rows: ok');
  }
}

process.exit(failures.length ? 1 : 0);
