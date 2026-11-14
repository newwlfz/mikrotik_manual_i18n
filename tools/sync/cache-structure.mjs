#!/usr/bin/env node
/**
 * Build the structure cache from the official rendered pages.
 *
 * The official `.md` export is lossy inside table cells (lists, <br>, details)
 * and may also flatten body structure. This command fetches one rendered page per
 * official document, records body counts and, where needed, the cleaned cell
 * HTML that materialisation will put back.
 *
 *   node tools/sync/cache-structure.mjs --all
 *   node tools/sync/cache-structure.mjs --version=7.25 --limit=5
 *   node tools/sync/cache-structure.mjs --version=7.25 --refresh
 *
 * It is resumable: a page whose cached md_sha256 still matches is not fetched
 * again unless --refresh is given.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {
  docsDir,
  htmlUrlForPage,
  loadConfig,
  loadManifest,
  sha256,
  splitFrontMatter,
  upstreamDir,
  writeJson,
} from './lib/upstream.mjs';
import {allVersions, currentVersion} from './lib/versions.mjs';
import {cleanCell, countMarkdownBodyStructure, isWideTableAt, mdTables, splitRow, stripMarkdownBody, tableSlots} from './lib/table-structure.mjs';

const CACHE_SCHEMA = 2;
const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const CHECK_ALL = process.argv.includes('--all');
const REFRESH = process.argv.includes('--refresh');
const LIMIT = Number(arg('limit', '0'));
const ONLY = arg('only', '');
const REQUESTED = arg('version', '');
const config = loadConfig();
const versions = REQUESTED ? [REQUESTED] : CHECK_ALL ? allVersions() : [currentVersion()];
const CONCURRENCY = Number(arg('concurrency', config.fetch?.concurrency || 6));

async function fetchWithRetry(url, attempts = 3) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {'user-agent': config.fetch?.user_agent || 'mikrotik-manual-mirror/1.0'},
        signal: AbortSignal.timeout((config.fetch?.timeout_seconds || 60) * 1000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw last;
}

function contentRoot($) {
  const markdown = $('.theme-doc-markdown').first();
  if (markdown.length) return markdown;
  const mainArticle = $('main article').first();
  if (mainArticle.length) return mainArticle;
  const article = $('article').first();
  if (article.length) return article;
  const main = $('main').first();
  if (main.length) return main;
  return $('body');
}

function htmlStructure($, content) {
  // Body counts must exclude tables: the table comparison is separate, and
  // lists inside cells would otherwise swamp the body audit.
  const outside = content.clone();
  outside.find('table, pre, nav, footer, .theme-doc-breadcrumbs, .theme-doc-footer, .table-of-contents').remove();
  return {
    lists: outside.find('ul, ol').length,
    listItems: outside.find('li').length,
    br: outside.find('br').length,
    details: outside.find('details').length,
    tables: content.find('table').filter((_, element) => $(element).parents('table').length === 0).length,
    sup: outside.find('sup').length,
    code: outside.find('code').length,
    wideTables: $('.wideTableInline').length,
  };
}

function markdownHardBreaks(body) {
  return (body.match(/ {2,}\n/g) || []).length;
}

function compareBody(html, local, localText) {
  const flags = {};
  if (html.listItems !== local.listMarkers) flags.listItems = [html.listItems, local.listMarkers];
  const br = local.br + markdownHardBreaks(localText);
  if (html.br !== br) flags.br = [html.br, br];
  if (html.details !== local.details) flags.details = [html.details, local.details];
  if (local.tables > 0 && html.tables !== local.tables) flags.tables = [html.tables, local.tables];
  if (html.sup !== local.sup) flags.sup = [html.sup, local.sup];
  return flags;
}

function cellRows($, htmlRows, page) {
  return htmlRows.map((htmlRow) =>
    $(htmlRow)
      .children('th, td')
      .toArray()
      .map((cell) => cleanCell($(cell).html() || '', htmlUrlForPage(page) || page.source_url || '')),
  );
}

function recordRebuild(entry, htmlRows, page, $) {
  const rows = cellRows($, htmlRows, page);
  entry.rebuild_header = rows[0];
  entry.rebuild_rows = rows.slice(1);
}

function cachePage($, page, mdText, localText, htmlText) {
  const content = contentRoot($);
  const html = htmlStructure($, content);
  const lines = mdText.split('\n');
  // Pipe tables plus `<colgroup>` slots: the export loses the skeleton on a few
  // pages, and the slot still marks where the rendered table belongs.
  const tables = tableSlots(lines);
  // A table nested inside a cell (`<details>Path-cost table</details>`) is part
  // of its parent table, not a sibling of it. Counting it separately shifted
  // every following table by one and made the whole page unaligned.
  const htmlTables = content
    .find('table')
    .toArray()
    .filter((element) => $(element).parents('table').length === 0);
  const localDocument = splitFrontMatter(localText).body;
  const mdDocument = splitFrontMatter(mdText).body;
  const local = countMarkdownBodyStructure(localDocument);
  const md = countMarkdownBodyStructure(mdDocument);
  const localBodyText = stripMarkdownBody(localDocument);
  // CLI pages are generated from the CLI model and rendered through ArgTable;
  // their HTML tables are not backed by Markdown tables. Comparing them would
  // produce hundreds of false "unaligned" records.
  const isCli = page.local_path.startsWith('cli-reference/') || /<ArgTable\b/.test(mdText);

  const tableEntries = [];
  const unaligned = [];
  if (!isCli && tables.length && htmlTables.length && tables.length === htmlTables.length) {
  for (let index = 0; index < tables.length; index++) {
    const md = tables[index];
    const htmlTable = htmlTables[index];
    const htmlRows = ($(htmlTable).children('thead, tbody, tfoot').children('tr').length
      ? $(htmlTable).children('thead, tbody, tfoot').children('tr')
      : $(htmlTable).children('tr')).toArray();
    const mdRows = [md.header, ...md.rows];
    const officialWide = $(htmlTable).closest('.wideTableInline').length > 0;
    const mdWide = isWideTableAt(lines, md.start);
    const entry = {
      index,
      rows: htmlRows.length,
      cols: 0,
      official_wide: officialWide,
      md_wide: mdWide,
      cells: [],
    };
    if (md.slot) {
      // No Markdown table to compare against: the whole slot is rebuilt from
      // the rendered cells.
      entry.slot = true;
      entry.rebuild = true;
      entry.unaligned = {reason: 'colgroup-slot', markdown: 0, html: htmlRows.length};
      unaligned.push({table: index, ...entry.unaligned});
      recordRebuild(entry, htmlRows, page, $);
      tableEntries.push(entry);
      continue;
    }
    if (htmlRows.length !== mdRows.length) {
      entry.unaligned = {reason: 'row-count', markdown: mdRows.length, html: htmlRows.length};
      unaligned.push({table: index, ...entry.unaligned});
      entry.rebuild = true;
      recordRebuild(entry, htmlRows, page, $);
      tableEntries.push(entry);
      continue;
    }
    for (let row = 0; row < mdRows.length; row++) {
      const mdCells = splitRow(mdRows[row]);
      const htmlCells = $(htmlRows[row]).children('th, td').toArray();
      if (row === 0) entry.cols = htmlCells.length;
      if (htmlCells.length !== mdCells.length) {
        // Official Markdown can disagree with its own rendered table (an
        // unescaped pipe, a row that only exists in the page). The rendering is
        // authoritative: record every body row so the table can be rebuilt.
        entry.unaligned = {reason: 'cell-count', row, markdown: mdCells.length, html: htmlCells.length};
        unaligned.push({table: index, ...entry.unaligned});
        entry.rebuild = true;
        recordRebuild(entry, htmlRows, page, $);
        break;
      }
      for (let col = 0; col < mdCells.length; col++) {
        const cellHtml = $(htmlCells[col]).html() || '';
        if (!/<(ul|ol|br|details)\b/i.test(cellHtml)) continue;
        // Keep local images in Markdown form; embedding rendered data: URIs
        // would bloat the page for no benefit.
        if (mdCells[col].includes('![') || cellHtml.includes('data:image')) continue;
        const cleaned = cleanCell(cellHtml, htmlUrlForPage(page) || page.source_url || '');
        if (!cleaned) continue;
        const flat = mdCells[col].replace(/\s+/g, '');
        const structured = cleaned.replace(/\s+/g, '');
        if (flat === structured) continue;
        entry.cells.push({row, col, html: cleaned});
      }
    }
    tableEntries.push(entry);
  }
  } else if (!isCli && tables.length && htmlTables.length && tables.length !== htmlTables.length) {
    unaligned.push({reason: 'table-count', markdown: tables.length, html: htmlTables.length});
  }

  return {
    schema: CACHE_SCHEMA,
    version: page.version,
    local_path: page.local_path,
    source_url: page.source_url,
    html_url: htmlUrlForPage(page),
    md_sha256: sha256(mdText),
    html_sha256: sha256(htmlText),
    body: {
      html,
      md: {
        lists: md.listMarkers,
        listItems: md.listMarkers,
        br: md.br,
        details: md.details,
        tables: md.tables,
        sup: md.sup,
        code: md.code,
        wideTables: md.wideTables,
      },
      local: {
        lists: local.listMarkers,
        listItems: local.listMarkers,
        br: local.br,
        details: local.details,
        tables: local.tables,
        sup: local.sup,
        code: local.code,
        wideTables: local.wideTables,
      },
      flags: isCli ? {} : compareBody(html, local, localBodyText),
    },
    kind: isCli ? 'cli' : 'page',
    tables: tableEntries,
    unaligned,
  };
}

async function processVersion(version) {
  const manifest = loadManifest(version);
  if (!manifest) throw new Error(`missing manifest for ${version}; run upstream:fetch first`);
  const root = path.join(upstreamDir(version), 'structure');
  const pagesRoot = path.join(root, 'pages');
  const indexFile = path.join(root, 'index.json');
  const docsRoot = docsDir(version);
  const entries = [];
  const failures = [];
  const stats = {pages: 0, cached: 0, fetched: 0, failed: 0, tables: 0, cells: 0, flagged: 0};
  const official = (manifest.pages || []).filter((page) => page.origin === 'official' && (!ONLY || page.local_path.includes(ONLY)));
  let cursor = 0;

  async function worker() {
    for (;;) {
      const position = cursor++;
      if (position >= official.length || (LIMIT && position >= LIMIT)) return;
      const page = official[position];
      const cacheFile = path.join(pagesRoot, `${page.local_path}.json`);
      const localFile = path.join(docsRoot, page.local_path);
      const mdText = fs.readFileSync(path.join(upstreamDir(version), 'docs', page.local_path), 'utf8');
      const mdHash = sha256(mdText);
      if (!fs.existsSync(localFile)) {
        failures.push({local_path: page.local_path, error: 'local page missing'});
        stats.failed++;
        continue;
      }
      const localText = fs.readFileSync(localFile, 'utf8');
      const existing = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : null;
      if (!REFRESH && existing?.schema === CACHE_SCHEMA && existing.md_sha256 === mdHash) {
        entries.push(existing);
        stats.cached++;
        stats.tables += existing.tables?.length || 0;
        stats.cells += (existing.tables || []).reduce((sum, table) => sum + (table.cells?.length || 0), 0);
        if (Object.keys(existing.body?.flags || {}).length) stats.flagged++;
      } else {
        try {
          const htmlUrl = htmlUrlForPage(page);
          const html = await fetchWithRetry(htmlUrl);
          const $ = cheerio.load(html);
          const cache = cachePage($, {...page, version}, mdText, localText, html);
          writeJson(cacheFile, cache);
          entries.push(cache);
          stats.fetched++;
          stats.tables += cache.tables.length;
          stats.cells += cache.tables.reduce((sum, table) => sum + (table.cells?.length || 0), 0);
          if (Object.keys(cache.body.flags).length) stats.flagged++;
          if (stats.fetched % 100 === 0) console.log(`[${version}] fetched ${stats.fetched}/${official.length}`);
        } catch (error) {
          failures.push({local_path: page.local_path, url: htmlUrlForPage(page), error: error.message});
          stats.failed++;
          console.error(`[${version}] FAIL ${page.local_path}: ${error.message}`);
        }
      }
      stats.pages++;
    }
  }

  await Promise.all(Array.from({length: Math.max(1, CONCURRENCY)}, worker));

  entries.sort((a, b) => a.local_path.localeCompare(b.local_path));
  const index = {
    schema: CACHE_SCHEMA,
    version,
    generated_at: new Date().toISOString(),
    source_manifest: `upstream/${version}/manifest.json`,
    totals: {
      pages: entries.length,
      tables: stats.tables,
      cells: stats.cells,
      flagged: stats.flagged,
      failed: stats.failed,
    },
    pages: entries.map((entry) => ({
      local_path: entry.local_path,
      md_sha256: entry.md_sha256,
      html_sha256: entry.html_sha256,
      body: entry.body,
      tables: entry.tables.length,
      mdTables: entry.body?.md?.tables ?? 0,
      htmlTables: entry.body?.html?.tables ?? 0,
      wide: {
        md: entry.body?.md?.wideTables ?? 0,
        html: entry.body?.html?.wideTables ?? 0,
        local: entry.body?.local?.wideTables ?? 0,
      },
      unaligned: entry.unaligned?.length || 0,
      flags: entry.body?.flags || {},
      cache: `upstream/${version}/structure/pages/${entry.local_path}.json`,
    })),
    failures,
  };
  writeJson(indexFile, index);
  console.log(
    `[${version}] done pages=${stats.pages} cached=${stats.cached} fetched=${stats.fetched} failed=${stats.failed} tables=${stats.tables} cells=${stats.cells} flagged=${stats.flagged}`,
  );
  return {version, index, stats, failures};
}

const results = [];
for (const version of versions) results.push(await processVersion(version));

// Wide-table audit: official md marker, official HTML wrapper, local md marker.
const wide = {schema: 1, generated_at: new Date().toISOString(), versions: {}, mismatches: []};
for (const result of results) {
  wide.versions[result.version] = {
    md: 0,
    html: 0,
    local: 0,
    pages: result.index.pages.length,
  };
  for (const page of result.index.pages) {
    wide.versions[result.version].md += page.wide.md;
    wide.versions[result.version].html += page.wide.html;
    wide.versions[result.version].local += page.wide.local;
    if (page.wide.md !== page.wide.html || page.wide.md !== page.wide.local) {
      wide.mismatches.push({version: result.version, local_path: page.local_path, ...page.wide});
    }
  }
}
writeJson(path.join(config.report_dir || 'reports', 'wide-table-audit.json'), wide);

const body = {schema: 1, generated_at: new Date().toISOString(), versions: {}, flagged: []};
for (const result of results) {
  const flagged = result.index.pages.filter((page) => Object.keys(page.flags || {}).length);
  body.versions[result.version] = {
    pages: result.index.pages.length,
    flagged: flagged.length,
    unaligned: result.index.pages.reduce((sum, page) => sum + (page.unaligned || 0), 0),
  };
  for (const page of flagged) body.flagged.push({version: result.version, local_path: page.local_path, flags: page.flags});
}
writeJson(path.join(config.report_dir || 'reports', 'body-structure-audit.json'), body);

const failures = results.reduce((sum, result) => sum + result.failures.length, 0);
if (failures) {
  console.error(`structure cache completed with ${failures} failure(s)`);
  process.exitCode = 1;
}
