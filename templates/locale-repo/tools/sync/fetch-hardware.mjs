#!/usr/bin/env node
/**
 * `fetch-hardware` — turn the official Hardware Guides into a real product.
 *
 * Inventory: the `## Hardware Guides` section of the official `llms.txt`
 * (264 direct `.md` links today, grouped by `###` category headings). Category
 * labels / ordering / landing-page links come from the rendered `/hardware/`
 * HTML: all 13 nav categories are kept, including Quick Guides as the first
 * category. Unknown non-guide entries are classified dynamically (historic
 * overrides -> known heading -> title/slug keywords -> generic Accessories
 * bucket) instead of throwing, so a newly published page cannot abort the run.
 *
 * Output: `hardware/<category>/<slug>.md`, 13 `_category_.json` files,
 * `hardware/index.md` and `data/manifests/hardware.json`. Every Markdown file
 * gets this run's `captured_at` (the manifest's `generated_at`) plus a `source`.
 * Guides whose rendered page carries `p.pdf-download` also receive that sentence
 * (with its original PDF href) at the top of the body; the `.md` export itself
 * never carries it. The manifest records the injected line as `pdf_notice`.
 *
 * `hardware/index.md` is *not* rebuilt from the official short description:
 * it is the hub's hand-authored landing page (it is the `index` entry of
 * `sidebars-hardware.ts` and carries the "Browse a product category" wording).
 * The stage keeps that body and only refreshes its provenance front matter, so
 * the local landing semantics survive a fetch. The official page is used only
 * as a fallback when the local file is absent.
 *
 *   node tools/sync/fetch-hardware.mjs                 # fetch + write
 *   node tools/sync/fetch-hardware.mjs --concurrency=4
 *   node tools/sync/fetch-hardware.mjs --check         # offline manifest check
 */

import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as cheerio from 'cheerio';
import {
  BASE_URL,
  REPO,
  checkManifest,
  composeMarkdown,
  fetchText,
  fileFacts,
  frontMatterValue,
  mapLimit,
  parseMarkdown,
  readJson,
  writeJson,
} from './lib/render-page.mjs';
import {
  HARDWARE_CATEGORY_KEYS,
  QUICK_GUIDE_OVERRIDES,
  classifyHardwareEntry,
  parseHardwareEntries,
} from './lib/official-zones.mjs';

const CHECK = process.argv.includes('--check');
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Number(concurrencyArg?.split('=')[1] || 4);
const HARDWARE = path.join(REPO, 'hardware');
const MANIFEST = path.join(REPO, 'data/manifests/hardware.json');
const LLMS_URL = `${BASE_URL}/llms.txt`;
const INDEX_URL = `${BASE_URL}/hardware/`;

// The hub's hardware tree has 13 categories (see sidebars-hardware.ts). The
// shared classifier keeps these keys, quick-guide detection, historic overrides
// and a keyword/generic fallback for every newly published page; see
// lib/official-zones.mjs. No section or slug can fail classification any more.
const CATEGORY_KEYS = HARDWARE_CATEGORY_KEYS;

/**
 * The official Markdown export carries a `> lead` blockquote that the official
 * rendered page drops; the same text is repeated in the body. Keeping both
 * produces a second paragraph on every hardware page (8/8 sampled), so drop the
 * leading quote when materialising the mirror page. Pure and exported for tests.
 */
export function stripOfficialLead(markdown) {
  const text = String(markdown || '');
  const lines = text.split(/\r?\n/);
  let index = 0;
  // The export starts with a `# Title` (and often a blank line) before the lead.
  // Skip those for detection but keep them in the output.
  while (index < lines.length && (!lines[index].trim() || /^\s*#\s/.test(lines[index]))) index++;
  if (index >= lines.length || !/^\s*>\s?/.test(lines[index])) return text.trim();
  const dropFrom = index;
  while (index < lines.length && (/^\s*>\s?/.test(lines[index]) || !lines[index].trim())) index++;
  return [...lines.slice(0, dropFrom), ...lines.slice(index)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The official `.md` export cross-links into the docs zone relatively, e.g.
 * `[PPP Client](../../docs/mobile-networking/ppp)`. Hardware routes are flat
 * (`/hardware/<slug>`), so a two-or-more-level `../` resolves above the site
 * root: Docusaurus then emits a bare `href="/docs/..."` with no baseUrl.
 * Rewriting the target to the site-absolute `/docs/...` lets the normal
 * `<Link>` add baseUrl, just like links authored in the docs body. Do NOT
 * prefix the href here — Docusaurus's autoAddBaseUrl does that once.
 *
 * Only `../../docs/` and deeper are touched. Single-level `../docs/` from a
 * flat hardware route already resolves to `/docs/...` with baseUrl intact, so
 * it is deliberately left byte-for-byte unchanged. Pure and exported for the
 * offline gate / selftest.
 */
export function normalizeCrossPluginDocLinks(markdown) {
  return String(markdown ?? '').replaceAll(/\]\(\.\.(?:\/\.\.)+\/docs\//g, '](/docs/');
}

/* ------------------------------------------------------------------------- *
 * Official PDF download notice
 *
 * The official `.md` export drops the `p.pdf-download` paragraph that the
 * rendered guide carries. A Markdown-only mirror therefore silently loses the
 * "This guide can be downloaded as a PDF file" hint on the guides that have a
 * PDF. Recover the sentence and its href from the rendered page and inline it
 * at the very top of the Markdown body (just after front matter), in the same
 * shape as the historically exported pages.
 *
 * This is text only. Binary PDF discovery/fetching remains the job of
 * capture-pdf-links / sync-pdfs; nothing here touches an image or a PDF blob.
 * Every helper is pure (apart from `fetchText`) and exported for the gate.
 * ------------------------------------------------------------------------- */

const PDF_NOTICE_WORDING = /^This guide can be downloaded as a\s+PDF file\.?$/i;
const PDF_HREF_RE = /(?:^|\/)assets\/files\/[^\s"'>]+\.pdf(?:[?#][^\s"'>]*)?$/i;

/** The mirror's canonical one-line notice, shaped like the historical export. */
export function buildPdfNotice(href) {
  return `This guide can be downloaded as a <a href="${String(href || '').trim()}" target="_blank" rel="noopener">PDF file</a>.`;
}

/** True when a Markdown page already carries the injected sentence. */
export function hasPdfNotice(markdown) {
  const text = String(markdown || '');
  return /This guide can be downloaded as a\s*<a\b/i.test(text) &&
    /assets\/files\/[^\s"'>]+\.pdf/i.test(text);
}

/**
 * Recover the canonical notice from an official rendered HTML page.
 * Returns null when the page has no PDF paragraph, a different sentence, or no
 * usable `/assets/files/<name>.pdf` href; callers treat all three as "no hint".
 */
export function pdfNoticeFromHtml(html) {
  const $ = cheerio.load(String(html || ''));
  const node = $('p.pdf-download, .pdf-download, p.pdf_download, [class*="pdf-download"]').first();
  if (!node.length) return null;
  if (!PDF_NOTICE_WORDING.test(node.text().replace(/\s+/g, ' ').trim())) return null;
  const anchor = node.find('a[href]').first();
  let href = (anchor.attr('href') || '').trim();
  if (!PDF_HREF_RE.test(href)) return null;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href, BASE_URL);
      href = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  return buildPdfNotice(href);
}

/** Read a previously injected notice so a re-fetch needs no extra HTML request. */
export function pdfNoticeFromMarkdown(markdown) {
  const line = String(markdown || '')
    .split(/\r?\n/)
    .find((candidate) => hasPdfNotice(candidate));
  return line ? line.trim() : null;
}

/** Inject the notice at the top of the body (right after front matter). */
export function injectPdfNotice(markdown, notice) {
  const text = String(markdown || '');
  if (!notice || hasPdfNotice(text)) return text;
  const {lines, body} = parseMarkdown(text.trim());
  if (!lines.length) return `${notice}\n\n${body.trim()}\n`;
  return composeMarkdown({}, lines, `${notice}\n\n${body.trim()}`);
}

/** Rendered URL of one guide; keeps an archived `/docs/<version>/` prefix. */
export function renderedPageUrl(source, slug) {
  const fallback = `${BASE_URL}/hardware/${slug}`;
  const value = String(source || '').trim();
  if (!value) return fallback;
  try {
    return new URL(value, BASE_URL).href.replace(/\.md(?=$|[?#])/i, '');
  } catch {
    return fallback;
  }
}



/** Backwards-compatible wrapper used by the offline checks and the selftest. */
export function localCategory(officialLabel, slug, title = '', description = '') {
  return classifyHardwareEntry({slug, title, description, category_label: officialLabel}).category;
}

export function parseHardwareSection(llms) {
  const pages = parseHardwareEntries(llms);
  if (pages.length < 250) throw new Error(`llms.txt Hardware Guides has only ${pages.length} pages`);
  const duplicates = pages.map((page) => page.slug).filter((slug, i, all) => all.indexOf(slug) !== i);
  if (duplicates.length) throw new Error(`duplicate hardware slugs: ${duplicates.join(', ')}`);
  return pages;
}

function categoryPlan(html, pages) {
  const $ = cheerio.load(html);
  const nav = $('a.categoryLink_byQd')
    .map((_, element) => ({
      label: $(element).text().trim(),
      slug: ($(element).attr('href') || '').replace(/^\/hardware\//, '').replace(/\/$/, ''),
    }))
    .get()
    .filter((item) => item.label && item.slug);
  const categories = [];
  for (const item of nav) {
    // Every official nav category must have a local key. Skipping an unknown
    // label used to drop "Quick Guides" together with its 13 pages.
    const key = CATEGORY_KEYS[item.label];
    if (!key) throw new Error(`/hardware/ nav label "${item.label}" has no local category key`);
    const old = readJson(path.join(HARDWARE, key, '_category_.json'), {});
    const link = old.link?.id ? old.link : null;
    categories.push({
      key,
      label: item.label,
      // Position is the nav traversal order (index is position 1).
      position: categories.length + 2,
      link: link || {type: 'doc', id: `${key}/${item.slug}`}
    });
  }
  // The assertion is against the official nav sequence, not a hardcoded count:
  // a new official category must be added explicitly, and a missing one fails.
  const navLabels = nav.map((item) => item.label);
  const planLabels = categories.map((category) => category.label);
  if (planLabels.join('\u0000') !== navLabels.join('\u0000')) {
    throw new Error(
      `hardware category plan != official /hardware/ nav labels: ` +
        `official=[${navLabels.join(', ')}] plan=[${planLabels.join(', ')}]`,
    );
  }
  const known = new Set(pages.map((page) => page.slug));
  for (const category of categories) {
    const target = path.join(HARDWARE, category.key, '_category_.json');
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, `${JSON.stringify(category, null, 2)}\n`);
  }
  return categories;
}

async function writeIndex(generatedAt) {
  const file = path.join(HARDWARE, 'index.md');
  const previous = fs.existsSync(file) ? parseMarkdown(fs.readFileSync(file, 'utf8')) : null;
  let body = previous?.body;
  if (!body) {
    const official = (await fetchText(`${BASE_URL}/hardware.md`)).replace(/^---[\s\S]*?---\s*/, '');
    // The official renderer drops the leading `> lead` blockquote; its text is
    // repeated in the body, so keeping it renders the same paragraph twice.
    body = stripOfficialLead(official);
  }
  const fields = {
    title: frontMatterValue(previous?.lines || [], 'title') || 'Hardware Guides',
    source: INDEX_URL,
    captured_at: generatedAt,
  };
  fs.writeFileSync(file, composeMarkdown(fields, previous?.lines || [], body));
  const facts = fileFacts(file);
  return {
    slug: 'index',
    title: fields.title,
    kind: 'landing',
    local_path: 'hardware/index.md',
    source_url: INDEX_URL,
    sha256: facts.sha256,
    body_sha256: facts.body_sha256,
    bytes: facts.bytes,
  };
}

async function main() {
  if (CHECK) {
    const result = checkManifest({name: 'hardware', manifestFile: MANIFEST, dir: 'hardware'});
    for (const line of result.lines) console.log(line);
    const categories = readJson(MANIFEST)?.categories || [];
    for (const category of categories) {
      const file = path.join(HARDWARE, category.key, '_category_.json');
      if (!fs.existsSync(file)) {
        console.log(`FAIL ${path.relative(REPO, file)}: missing category file`);
        result.ok = false;
      }
    }
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const generatedAt = new Date().toISOString();
  console.log(`fetch-hardware: ${generatedAt}, concurrency ${CONCURRENCY}`);
  const [llms, html] = await Promise.all([fetchText(LLMS_URL), fetchText(INDEX_URL)]);
  const pages = parseHardwareSection(llms);
  const breakdown = pages.reduce((counts, page) => {
    counts[page.category_source || 'heading'] = (counts[page.category_source || 'heading'] || 0) + 1;
    return counts;
  }, {});
  const dynamic = pages.filter((page) => page.category_source === 'keyword' || page.category_source === 'generic');
  console.log(
    `fetch-hardware: classified ${pages.length} guides ` +
      `(overrides ${Object.keys(QUICK_GUIDE_OVERRIDES).length}, ` +
      `keyword ${breakdown.keyword || 0}, generic ${breakdown.generic || 0})`,
  );
  for (const page of dynamic.slice(0, 20)) {
    console.log(`  ${page.slug} -> ${page.category} (${page.category_source})`);
  }
  const categories = categoryPlan(html, pages);
  let noticeFetches = 0;
  let noticeFailures = 0;
  const {results, errors} = await mapLimit(pages, CONCURRENCY, async (item) => {
    const url = `${BASE_URL}/hardware/${item.slug}.md`;
    const officialMd = await fetchText(url);
    const file = path.join(HARDWARE, item.category, `${item.slug}.md`);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const previousText = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const previous = previousText ? parseMarkdown(previousText) : null;

    // The hint lives in the rendered page only. Reuse it from the local page
    // when already present (idempotent, and no extra request on re-runs);
    // otherwise probe the official rendered page with the same bounded pool.
    // Dynamic detection only: no slug list, and a page without a PDF simply
    // gets no notice. A probe failure is never fatal for the fetch stage.
    let notice = pdfNoticeFromMarkdown(previousText);
    if (!notice) {
      const renderedUrl = renderedPageUrl(
        previous ? frontMatterValue(previous.lines, 'source') : null,
        item.slug,
      );
      noticeFetches++;
      try {
        notice = pdfNoticeFromHtml(await fetchText(renderedUrl));
      } catch {
        noticeFailures++;
        notice = null;
      }
    }
    // Same `> lead` duplication on ordinary hardware pages (8/8 sampled): drop
    // the first quote so the mirror renders what the official site renders.
    // Cross-plugin doc links are normalised here, before the md is written, so
    // a re-fetch cannot bring back relative `../../docs/...` targets that lose
    // baseUrl in the built page.
    const body = normalizeCrossPluginDocLinks(
      injectPdfNotice(stripOfficialLead(officialMd), notice),
    );
    const fields = {
      title: item.title,
      slug: `/${item.slug}`,
      source: `${BASE_URL}/hardware/${item.slug}`,
      captured_at: generatedAt,
    };
    fs.writeFileSync(file, composeMarkdown(fields, previous?.lines || [], body));
    const facts = fileFacts(file);
    return {
      ...item,
      local_path: path.relative(REPO, file),
      source_url: url,
      ...(notice ? {pdf_notice: notice} : {}),
      sha256: facts.sha256,
      body_sha256: facts.body_sha256,
      bytes: facts.bytes,
    };
  });
  console.log(
    `fetch-hardware: pdf notice probes ${noticeFetches}, injected ` +
      `${results.filter((page) => page?.pdf_notice).length}, probe failures ${noticeFailures}`,
  );
  for (const error of errors) console.error(`FAIL ${error.item.slug}: ${error.message}`);
  if (errors.length) {
    process.exitCode = 1;
    console.error(`fetch-hardware: ${errors.length}/${pages.length} pages failed; no manifest written`);
    return;
  }
  const index = await writeIndex(generatedAt);
  writeJson(MANIFEST, {
    schema: 1,
    generated_at: generatedAt,
    base_url: BASE_URL,
    inventory_url: LLMS_URL,
    category_index_url: INDEX_URL,
    concurrency: CONCURRENCY,
    categories,
    pages: [...results, index],
  });
  console.log(
    `fetch-hardware: wrote ${results.length} guides + index, ${categories.length} categories -> ` +
      path.relative(REPO, MANIFEST),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
