#!/usr/bin/env node
/**
 * `fetch-blog` — refresh the Product news section from the official site.
 *
 * There is no `/blog/<slug>.md` export, so the post list is discovered from
 * the rendered `/blog/` HTML (Recent posts) and each post is rendered with
 * Playwright + turndown, reusing the shared logic in `lib/render-page.mjs`.
 * When Playwright times out on a page, that page falls back to a pure HTTP
 * fetch of the same server-rendered HTML (cheerio mirrors the Playwright
 * extraction), so one flaky renderer cannot block the whole blog refresh.
 * Writes `blog/<slug>.md` with title/date/slug/source/captured_at in the front
 * matter (an existing `tags:` block is preserved) and a page-level manifest.
 *
 *   node tools/sync/fetch-blog.mjs                 # fetch + write
 *   node tools/sync/fetch-blog.mjs --concurrency=4
 *   node tools/sync/fetch-blog.mjs --check         # offline manifest check
 */

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {
  BASE_URL,
  REPO,
  checkManifest,
  composeMarkdown,
  createTurndown,
  fetchText,
  fileFacts,
  frontMatterValue,
  mapLimit,
  parseMarkdown,
  renderArticle,
  tagSelectorFor,
  toMarkdown,
  withBrowser,
  writeJson,
} from './lib/render-page.mjs';

const CHECK = process.argv.includes('--check');
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Number(concurrencyArg?.split('=')[1] || 4);
const BLOG = path.join(REPO, 'blog');
const MANIFEST = path.join(REPO, 'data/manifests/blog.json');
const INDEX_URL = `${BASE_URL}/blog/`;

function discoverSlugs(html) {
  const $ = cheerio.load(html);
  const slugs = $('a[href]')
    .map((_, element) => {
      const href = $(element).attr('href') || '';
      const match = /^\/blog\/(news\d+)\/?$/.exec(href);
      return match ? match[1] : null;
    })
    .get()
    .filter(Boolean);
  const unique = [...new Set(slugs)].sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
  if (!unique.length) throw new Error('/blog/ HTML has no newsNNN links');
  return unique;
}

/**
 * Pure-HTTP renderer for one article, used only when Playwright cannot render
 * it (navigation/render timeout). It mirrors the `page.evaluate` body of
 * renderArticle() so both paths produce exactly the same four fields from the
 * server-side HTML. No validation is relaxed: a missing article body is still
 * a hard error, and tags/date/title extraction follows the same rules.
 */
async function renderArticleHttp(url) {
  const $ = cheerio.load(await fetchText(url));
  const selector = tagSelectorFor(url);
  const article = $('article').first();
  const time = article.find('time').first();
  const tags = [
    ...new Map(
      $(selector)
        .toArray()
        .map((anchor) => {
          const label = $(anchor).text().trim();
          const permalink = ($(anchor).attr('href') || '').split('/').filter(Boolean).at(-1) || '';
          return label && permalink ? [permalink, {label, permalink}] : null;
        })
        .filter(Boolean),
    ).values(),
  ];
  const data = {
    title: article.find('h1').first().text().trim() || $('title').text().trim(),
    date: time.attr('datetime') || time.text().trim() || '',
    html: article.html() || '',
    tags,
  };
  if (!data.html) throw new Error(`${url}: no article body`);
  return data;
}

async function fetchOne(page, slug, renderer, generatedAt) {
  const url = `${BASE_URL}/blog/${slug}`;
  let rendered;
  try {
    rendered = await renderArticle(page, url);
  } catch (error) {
    console.warn(`fetch-blog: Playwright render failed for ${slug} (${error.message}); using HTTP fallback`);
    rendered = await renderArticleHttp(url);
  }
  const body = toMarkdown(rendered.html, renderer);
  const file = path.join(BLOG, `${slug}.md`);
  fs.mkdirSync(BLOG, {recursive: true});
  const previous = fs.existsSync(file) ? parseMarkdown(fs.readFileSync(file, 'utf8')) : null;
  const tags = previous
    ? previous.lines
    : rendered.tags.length
      ? [
          'tags:',
          ...rendered.tags.flatMap((tag) => [
            `  - label: ${JSON.stringify(tag.label)}`,
            `    permalink: ${tag.permalink}`,
          ]),
        ]
      : [];
  const fields = {
    title: rendered.title,
    date: rendered.date || frontMatterValue(tags, 'date') || '',
    slug: `/${slug}`,
    source: url,
    captured_at: generatedAt,
  };
  fs.writeFileSync(file, composeMarkdown(fields, tags, body));
  const facts = fileFacts(file);
  return {
    slug,
    title: fields.title,
    date: fields.date,
    local_path: path.relative(REPO, file),
    source_url: url,
    sha256: facts.sha256,
    body_sha256: facts.body_sha256,
    bytes: facts.bytes,
  };
}

async function main() {
  if (CHECK) {
    const result = checkManifest({name: 'blog', manifestFile: MANIFEST, dir: 'blog'});
    for (const line of result.lines) console.log(line);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const generatedAt = new Date().toISOString();
  console.log(`fetch-blog: ${generatedAt}, concurrency ${CONCURRENCY}`);
  const slugs = discoverSlugs(await fetchText(INDEX_URL));
  console.log('fetch-blog: discovered', slugs.length, slugs.join(', '));

  // One owned browser, one page per worker: concurrent workers must not
  // navigate the same page. The turndown instance is stateless and shared.
  const renderer = createTurndown();
  const pages = await withBrowser(async (firstPage) => {
    const context = firstPage.context();
    const {results, errors} = await mapLimit(slugs, CONCURRENCY, async (slug) => {
      const worker = await context.newPage();
      try {
        return await fetchOne(worker, slug, renderer, generatedAt);
      } finally {
        await worker.close();
      }
    });
    if (errors.length) {
      for (const error of errors) console.error(`FAIL ${error.item}: ${error.message}`);
      throw new Error(`${errors.length}/${slugs.length} blog posts failed`);
    }
    return results;
  });
  writeJson(MANIFEST, {
    schema: 1,
    generated_at: generatedAt,
    base_url: BASE_URL,
    index_url: INDEX_URL,
    concurrency: CONCURRENCY,
    pages,
  });
  console.log(`fetch-blog: wrote ${pages.length} posts -> ${path.relative(REPO, MANIFEST)}`);
}

await main().catch((error) => {
  console.error(`fetch-blog: ${error.message}`);
  process.exitCode = 1;
});
