#!/usr/bin/env node
/**
 * `fetch-changelog` — refresh the Docs Changes section from the official site.
 *
 * The slug list is discovered from rendered HTML (`/changelog/` followed by
 * the "Older entries" pagination), never from a checked-in manifest: the
 * official `/changelog/<slug>.md` exports are 404, so only the rendered
 * `/changelog/<slug>` route works. A legacy `blog-changelog.json` is accepted
 * as a *seed* for very old entries but is never authoritative.
 *
 * When Playwright times out on a page, that page falls back to a pure HTTP
 * fetch of the same server-rendered HTML (cheerio mirrors the Playwright
 * extraction), so one flaky renderer cannot abort the whole changelog refresh.
 *
 * Every run re-fetches every discovered page and compares the Markdown body
 * sha256 with the local copy, so an edited official entry is refreshed rather
 * than silently skipped. Front matter gains `source` and a run-level
 * `captured_at` (the manifest's `generated_at`) plus a `tags:` block taken from
 * the rendered article, so the changelog tag pages exist at build time.
 *
 *   node tools/sync/fetch-changelog.mjs                 # fetch + write
 *   node tools/sync/fetch-changelog.mjs --concurrency=4
 *   node tools/sync/fetch-changelog.mjs --check         # offline manifest check
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
  mapLimit,
  parseMarkdown,
  readJson,
  renderArticle,
  tagSelectorFor,
  toMarkdown,
  withBrowser,
  writeJson,
} from './lib/render-page.mjs';

const CHECK = process.argv.includes('--check');
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Number(concurrencyArg?.split('=')[1] || 4);
const CHANGELOG = path.join(REPO, 'changelog');
const MANIFEST = path.join(REPO, 'data/manifests/changelog.json');
const LEGACY_MANIFEST = path.join(REPO, 'data/manifests/blog-changelog.json');
const INDEX_URL = `${BASE_URL}/changelog/`;
const SLUG_RE = /^changelog-\d{4}-\d{2}-\d{2}$/;

async function discoverSlugs() {
  const found = new Set();
  const visited = new Set();
  let url = INDEX_URL;
  while (url && !visited.has(url) && visited.size < 50) {
    visited.add(url);
    const $ = cheerio.load(await fetchText(url));
    for (const href of $('a[href^="/changelog/changelog-"]').map((_, el) => $(el).attr('href')).get()) {
      const slug = String(href).replace(/\/+$/, '').split('/').at(-1);
      if (SLUG_RE.test(slug)) found.add(slug);
    }
    const older = $('a.pagination-nav__link--next, a[href^="/changelog/page/"]')
      .filter((_, el) => /older|旧|下一/i.test($(el).text()))
      .first()
      .attr('href');
    url = older ? new URL(older, BASE_URL).href : null;
  }
  if (!found.size) throw new Error('no changelog slugs discovered from rendered HTML');
  return {slugs: [...found].sort().reverse(), pagesVisited: visited.size};
}

function legacySeeds(discovered) {
  const legacy = readJson(LEGACY_MANIFEST);
  if (!legacy?.changelog) return [];
  return legacy.changelog
    .filter((url) => !url.includes('/page/'))
    .map((url) => url.replace(/\/+$/, '').split('/').at(-1))
    .filter((slug) => SLUG_RE.test(slug) && !discovered.has(slug));
}

/**
 * Pure-HTTP renderer for one article, used only when Playwright cannot render
 * it (navigation/render timeout). It mirrors the `page.evaluate` body of
 * renderArticle() so both paths produce exactly the same four fields from the
 * server-side HTML. tagSelectorFor() derives `/changelog/tags/…` from the
 * article URL, matching the changelog blog-plugin instance. No validation is
 * relaxed: a missing article body is still a hard error, and tags/date/title
 * extraction follows the same rules.
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

async function fetchOne(page, item, renderer, generatedAt) {
  const url = `${BASE_URL}/changelog/${item.slug}`;
  let rendered;
  try {
    rendered = await renderArticle(page, url);
  } catch (error) {
    console.warn(
      `fetch-changelog: Playwright render failed for ${item.slug} (${error.message}); using HTTP fallback`,
    );
    rendered = await renderArticleHttp(url);
  }
  const body = toMarkdown(rendered.html, renderer);
  const file = path.join(CHANGELOG, `${item.slug}.md`);
  fs.mkdirSync(CHANGELOG, {recursive: true});
  const previous = fs.existsSync(file) ? parseMarkdown(fs.readFileSync(file, 'utf8')) : null;
  const changed = !previous || previous.body.trim() !== body;
  const date =
    rendered.date ||
    (item.slug.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] ||
    new Date().toISOString().slice(0, 10);
  // Same contract as fetch-blog: an existing `tags:` block is carried over
  // verbatim (never duplicated); a page that has none gets the tags rendered on
  // the official article — for Docs Changes that is the single "Documentation
  // changelog" / `changelog` tag. Without a tags front matter Docusaurus creates
  // no `/changelog/tags/changelog` route and the page 404s.
  const previousLines = previous?.lines || [];
  const hasTags = previousLines.some((line) => /^tags\s*:/.test(line));
  const tags = hasTags
    ? previousLines
    : [
        ...previousLines,
        ...(rendered.tags.length
          ? [
              'tags:',
              ...rendered.tags.flatMap((tag) => [
                `  - label: ${JSON.stringify(tag.label)}`,
                `    permalink: ${tag.permalink}`,
              ]),
            ]
          : []),
      ];
  const fields = {
    title: rendered.title,
    date,
    slug: `/${item.slug}`,
    source: url,
    captured_at: generatedAt,
  };
  fs.writeFileSync(file, composeMarkdown(fields, tags, body));
  const facts = fileFacts(file);
  return {
    slug: item.slug,
    title: fields.title,
    date: fields.date,
    changed,
    from_seed: !!item.seed_only,
    local_path: path.relative(REPO, file),
    source_url: url,
    sha256: facts.sha256,
    body_sha256: facts.body_sha256,
    bytes: facts.bytes,
  };
}

async function main() {
  if (CHECK) {
    const result = checkManifest({name: 'changelog', manifestFile: MANIFEST, dir: 'changelog'});
    for (const line of result.lines) console.log(line);
    // Informational only: the freshness assertion compares against the official
    // index dynamically (verify:build-inputs via lib/official-zones.mjs), so a
    // pinned floor here would go stale on every new official entry.
    const latest = readJson(MANIFEST)?.latest_slug;
    console.log(`changelog: manifest latest_slug ${latest || '(none)'} (informational)`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const generatedAt = new Date().toISOString();
  console.log(`fetch-changelog: ${generatedAt}, concurrency ${CONCURRENCY}`);
  const {slugs, pagesVisited} = await discoverSlugs();
  const discovered = new Set(slugs);
  const seeds = legacySeeds(discovered);
  const items = [
    ...slugs.map((slug) => ({slug, seed_only: false})),
    ...seeds.map((slug) => ({slug, seed_only: true})),
  ];
  console.log(
    `fetch-changelog: discovered ${slugs.length} slugs over ${pagesVisited} index pages` +
      `, ${seeds.length} legacy seed(s)`,
  );

  const renderer = createTurndown();
  const fetched = await withBrowser(async (firstPage) => {
    const context = firstPage.context();
    const {results, errors} = await mapLimit(items, CONCURRENCY, async (item) => {
      const worker = await context.newPage();
      try {
        return await fetchOne(worker, item, renderer, generatedAt);
      } finally {
        await worker.close();
      }
    });
    const ok = [];
    for (let i = 0; i < results.length; i++) {
      if (!results[i]) continue;
      ok.push(results[i]);
    }
    for (const error of errors) {
      const item = error.item;
      if (item.seed_only) {
        console.warn(`WARN legacy seed ${item.slug} unavailable (${error.message}); ignored`);
        continue;
      }
      console.error(`FAIL ${item.slug}: ${error.message}`);
      throw new Error(`${errors.filter((e) => !e.item.seed_only).length} changelog pages failed`);
    }
    return ok.sort((a, b) => b.slug.localeCompare(a.slug));
  });

  writeJson(MANIFEST, {
    schema: 1,
    generated_at: generatedAt,
    base_url: BASE_URL,
    index_url: INDEX_URL,
    concurrency: CONCURRENCY,
    pages_visited: pagesVisited,
    legacy_seeds_ignored: seeds.length,
    changed: fetched.filter((page) => page.changed).length,
    latest_slug: fetched[0]?.slug || null,
    pages: fetched,
  });
  console.log(
    `fetch-changelog: wrote ${fetched.length} entries (${fetched.filter((p) => p.changed).length} changed)` +
      ` -> ${path.relative(REPO, MANIFEST)}`,
  );
}

await main().catch((error) => {
  console.error(`fetch-changelog: ${error.message}`);
  process.exitCode = 1;
});
