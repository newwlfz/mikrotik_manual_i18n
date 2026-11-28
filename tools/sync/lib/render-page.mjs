/**
 * Shared helpers for the three fetch stages that turn official pages into
 * committed Markdown (`fetch-hardware`, `fetch-blog`, `fetch-changelog`).
 *
 * The helpers are deliberately transport-only: they never decide which pages
 * to fetch or where to write them. Two rendering paths are supported:
 *
 *   - `fetchText` for the plain HTTP `.md` / `llms.txt` exports (hardware);
 *   - `withBrowser` + `renderArticle` + `toMarkdown` for pages whose Markdown
 *     export does not exist (blog, changelog) and must be rendered first.
 *
 * Every stage writes a `source:` and a run-level `captured_at:` into the
 * front matter; `mergeFrontMatter` keeps any other front-matter keys the local
 * page already carries (e.g. the blog `tags:` block).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setDefaultResultOrder} from 'node:dns';
import {chromium} from 'playwright-core';
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const BASE_URL = 'https://manual.mikrotik.com';
export const USER_AGENT =
  'mikrotik-manual-mirror/1.0 (+https://github.com/newwlfz/mikrotik_manual_i18n)';

// The official host resolves to both AAAA and A records; some CI runners have
// no working IPv6 path and otherwise fail with a connect timeout.
if (typeof setDefaultResultOrder === 'function') setDefaultResultOrder('ipv4first');

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Retry transient network failures; a final failure is re-thrown. */
export async function fetchText(url, {retries = 2, timeoutMs = 60000} = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': USER_AGENT},
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw last;
}

/** Bounded-concurrency map; errors are collected instead of aborting the pool. */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  const errors = [];
  let cursor = 0;
  const runners = Array.from({length: Math.max(1, Math.min(limit, items.length))}, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        errors.push({item: items[index], message: error?.message || String(error)});
      }
    }
  });
  await Promise.all(runners);
  return {results, errors};
}

export function chromePath() {
  return (
    process.env.CHROME_PATH ||
    path.resolve(REPO, '../vendor/browsers/chrome-linux64/chrome')
  );
}

/** One owned browser per stage; the page is handed to the caller. */
export async function withBrowser(work, {viewport = {width: 1440, height: 900}} = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    // Use an explicit context: `browser.newPage()` creates an owned context that
    // refuses `page.context().newPage()`, which the bounded worker pools need.
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    return await work(page);
  } finally {
    await browser.close();
  }
}

/** Turndown configuration shared by the rendered-page fetch stages. */
export function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  turndown.use(gfm);
  // The exporter wraps heading text in a zero-width-space self-link; dropping it
  // keeps U+200B out of every heading (and out of every translation).
  turndown.addRule('dropHeadingAnchor', {
    filter: (node) =>
      node.nodeName === 'A' &&
      (node.classList?.contains('hash-link') ||
        (node.getAttribute?.('href')?.startsWith('#') &&
          node.textContent.replace(/\u200b/g, '').trim() === '')),
    replacement: () => '',
  });
  turndown.addRule('keepDetails', {
    filter: ['details'],
    replacement: (content, node) => `\n${node.outerHTML}\n`,
  });
  // The official article HTML ends with its own Docusaurus footer tag block:
  //   <b>Tags:</b><ul> … <a href="/<base>/tags/…" title="…" rel=tag>…</a> … </ul>
  // (a <p><strong>Tags:</strong></p> wrapper is another captured shape).
  // Converting it produces a second `**Tags:**` + tag-link list in the body,
  // duplicating the native front-matter tag footer Docusaurus renders from
  // `tags:`. Drop only that block. The selector is built with tagSelectorFor()
  // for every content blog so the pure-HTTP fallback (fetch-blog's
  // renderArticleHttp, which has no Playwright DOM step) is covered by the same
  // shared turndown instance. The `tags` array written to front matter is
  // extracted by the caller before conversion and is never touched here.
  // tagSelectorFor() derives the base from the URL's first path segment, so
  // pass an absolute URL (a bare '/changelog/' has no origin and would fall
  // back to the default 'blog' base).
  const officialTagLinks = [
    tagSelectorFor(`${BASE_URL}/blog/`),
    tagSelectorFor(`${BASE_URL}/changelog/`),
  ].join(',');
  turndown.addRule('dropOfficialTags', {
    filter: (node) => {
      // The official footer renders the label as a bare `<b>Tags:</b>` next to
      // the list (a `<p><strong>Tags:</strong>` wrapper is another shape seen
      // in captured HTML); either way it is the header we must drop with the
      // list, otherwise a lone `**Tags:**` line survives in the body.
      if (['B', 'STRONG', 'P'].includes(node.nodeName)) {
        return /^tags\s*:$/i.test(node.textContent.trim());
      }
      if (node.nodeName === 'UL' || node.nodeName === 'OL') {
        return !!node.querySelector?.(officialTagLinks);
      }
      return false;
    },
    replacement: () => '',
  });
  return turndown;
}

export function toMarkdown(html, turndown = createTurndown()) {
  return turndown.turndown(html).trim();
}

/**
 * Build the tags-link selector for one blog-plugin instance.
 *
 * Docusaurus mounts tags at `<routeBasePath>/tags/<permalink>`, so Product news
 * uses `/blog/tags/…` and Docs Changes uses `/changelog/tags/…`. Deriving the
 * base path from the article URL (or an explicit override) keeps this shared
 * helper correct for every content-blog instance; hardcoding one route silently
 * drops the tags of all the others.
 */
export function tagSelectorFor(url, routeBasePath) {
  let base = routeBasePath;
  if (!base) {
    try {
      base = new URL(url).pathname.split('/').filter(Boolean)[0];
    } catch {
      base = '';
    }
  }
  return `a[href^="/${base || 'blog'}/tags/"]`;
}

/** Render one article and return the pieces needed for Markdown front matter. */
export async function renderArticle(page, url, {timeoutMs = 90000, attempts = 2, routeBasePath} = {}) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await page.goto(url, {waitUntil: 'domcontentloaded', timeout: timeoutMs});
      await page.waitForSelector('article', {timeout: 45000});
      last = null;
      break;
    } catch (error) {
      last = error;
      if (attempt + 1 < attempts) await page.waitForTimeout(1000);
    }
  }
  if (last) throw last;
  await page.waitForTimeout(300);
  const tagSelector = tagSelectorFor(url, routeBasePath);
  const data = await page.evaluate((selector) => {
    const article = document.querySelector('article');
    const time = article?.querySelector('time');
    const tags = [...document.querySelectorAll(selector)]
      .map((anchor) => ({
        label: anchor.textContent.trim(),
        permalink: (anchor.getAttribute('href') || '').split('/').filter(Boolean).at(-1) || '',
      }))
      .filter((tag) => tag.label && tag.permalink);

    // Delete the official "Tags:" block from the HTML we hand to turndown,
    // together with its <ul> and the adjacent <b>/<strong> (or wrapping <p>)
    // "Tags:" header. The
    // `tags` array above was captured first from the same selector and stays
    // untouched: it is the single source for the front-matter tags block that
    // drives Docusaurus's native tag routes and footer.
    if (article) {
      for (const anchor of article.querySelectorAll(selector)) {
        const list = anchor.closest('ul');
        if (list) {
          const header = list.previousElementSibling;
          list.remove();
          // The label is the previous sibling of the list: a bare <b>/<strong>
          // on the official footer, or a <p> wrapping one in captured HTML.
          if (
            header &&
            ['B', 'STRONG', 'P'].includes(header.tagName) &&
            /^tags\s*:$/i.test(header.textContent.trim())
          ) {
            header.remove();
          }
        } else {
          const block = anchor.closest('p, li, div');
          if (block && /tags/i.test(block.textContent)) block.remove();
          else anchor.remove();
        }
      }
    }

    return {
      title: article?.querySelector('h1')?.textContent?.trim() || document.title,
      date: time?.getAttribute('datetime') || time?.textContent?.trim() || '',
      html: article?.innerHTML || '',
      tags: [...new Map(tags.map((tag) => [tag.permalink, tag])).values()],
    };
  }, tagSelector);
  if (!data.html) throw new Error(`${url}: no article body`);
  return data;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Split a Markdown file into its front-matter lines and body. */
export function parseMarkdown(text) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return {lines: [], body: text};
  return {
    lines: match[1].split(/\r?\n/),
    body: text.slice(match[0].length).replace(/^\r?\n/, ''),
  };
}

function formatValue(key, value) {
  const text = String(value ?? '');
  if (key === 'title') return JSON.stringify(text);
  if (key === 'captured_at') return `'${text.replace(/'/g, "''")}'`;
  return text;
}

/**
 * Rebuild a document with `fields` in a stable order, preserving every other
 * front-matter line (notably the blog `tags:` block) verbatim.
 */
export function composeMarkdown(fields, keptLines, body) {
  const keys = Object.keys(fields);
  const kept = (keptLines || []).filter(
    (line) => !keys.some((key) => line.startsWith(`${key}:`)),
  );
  const head = keys.map((key) => `${key}: ${formatValue(key, fields[key])}`);
  return `---\n${[...head, ...kept].join('\n')}\n---\n\n${String(body).trim()}\n`;
}

/**
 * Front-matter value lookup used by the offline `--check` modes and the fetch
 * stages. Titles are written with JSON.stringify, so a reused value may already
 * be wrapped in one or more escaped YAML double quotes (`title: "\"Hardware
 * Guides\""`). Unwrap repeatedly (and honour doubled single quotes) instead of
 * stripping only `'`: otherwise every fetch adds another quote layer and the
 * breadcrumb / JSON-LD / Next label shows `"Hardware Guides"`.
 */
export function frontMatterValue(lines, key) {
  const hit = (lines || []).find((line) => line.startsWith(`${key}:`));
  if (!hit) return null;
  let value = hit.slice(key.length + 1).trim();
  for (let attempt = 0; attempt < 8; attempt++) {
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (value.length < 2 || !quoted) break;
    if (value.startsWith('"')) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        break;
      }
      if (typeof parsed !== 'string' || parsed === value) break;
      value = parsed;
    } else {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
  }
  return value;
}

/** Read, hash and byte-count a file without ever following a symlink. */
export function fileFacts(file) {
  const text = fs.readFileSync(file, 'utf8');
  const {lines, body} = parseMarkdown(text);
  return {
    text,
    lines,
    body,
    sha256: sha256(text),
    body_sha256: sha256(body.trim()),
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Common `--check` verification for the three fetch manifests. */
export function checkManifest({name, manifestFile, dir}) {
  const lines = [];
  const manifest = readJson(manifestFile);
  if (!manifest) {
    lines.push(`FAIL ${name}: missing manifest ${path.relative(REPO, manifestFile)} (run the fetch stage)`);
    return {ok: false, lines};
  }
  const generatedAt = manifest.generated_at;
  if (!generatedAt || Number.isNaN(new Date(generatedAt).getTime())) {
    lines.push(`FAIL ${name}: manifest has no usable generated_at`);
    return {ok: false, lines};
  }
  const pages = manifest.pages || [];
  if (!pages.length) {
    lines.push(`FAIL ${name}: manifest has no page entries`);
    return {ok: false, lines};
  }
  let bad = 0;
  for (const page of pages) {
    const file = path.join(REPO, page.local_path || path.join(dir, page.slug + '.md'));
    if (!fs.existsSync(file)) {
      lines.push(`FAIL ${page.local_path}: missing file`);
      bad++;
      continue;
    }
    const facts = fileFacts(file);
    const source = frontMatterValue(facts.lines, 'source');
    const capturedAt = frontMatterValue(facts.lines, 'captured_at');
    const problems = [];
    if (!source) problems.push('no source');
    if (capturedAt !== generatedAt) problems.push(`captured_at ${capturedAt} != ${generatedAt}`);
    if (page.sha256 && facts.sha256 !== page.sha256) problems.push('sha256 mismatch');
    if (page.bytes && facts.bytes !== page.bytes) problems.push('bytes mismatch');
    if (problems.length) {
      lines.push(`FAIL ${path.relative(REPO, file)}: ${problems.join(', ')}`);
      bad++;
    }
  }
  if (bad) return {ok: false, lines};
  lines.push(`ok ${name}: ${pages.length} pages, generated_at ${generatedAt}`);
  return {ok: true, lines};
}
