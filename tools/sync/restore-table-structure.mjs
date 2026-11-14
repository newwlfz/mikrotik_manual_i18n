#!/usr/bin/env node
/**
 * Restore table-cell structure that the official `.md` export loses.
 *
 * The official Markdown endpoint flattens lists and drops <br> inside table
 * cells ("Configurable ports ...Full non-blocking ..."), while the rendered
 * official page keeps <ul>, <li> and <br>. Comparing the two shows the export
 * is lossy, so the mirror cannot match the rendered page from Markdown alone.
 *
 * This tool fetches the rendered page, aligns its tables with the local
 * Markdown tables and replaces a flattened cell with the inline HTML the page
 * uses. Everything else is left untouched.
 *
 *   node tools/sync/restore-table-structure.mjs --version=7.24            # report
 *   node tools/sync/restore-table-structure.mjs --version=7.24 --apply
 *   node tools/sync/restore-table-structure.mjs --version=7.24 --page=bridging-and-switching/marvell-prestra...
 */

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {REPO} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {splitRow, mdTables, cleanCell} from './lib/table-structure.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const VERSION = arg('version', '7.24');
const APPLY = process.argv.includes('--apply');
const LIMIT = Number(arg('limit', '0'));
const PAGE = arg('page', '');
const CONCURRENCY = Number(arg('concurrency', '4'));
const DIR = VERSION === '7.24' ? 'versioned_docs/version-7.24' : 'docs';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {'user-agent': 'mikrotik-manual-mirror/1.0'},
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const stats = {pages: 0, tables: 0, patchedCells: 0, skipped: 0, failed: 0, changedPages: 0};
const changed = [];

async function processPage(file) {
  const rel = path.relative(path.join(REPO, DIR), file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const {frontMatter, body} = splitFrontMatter(text);
  let source = readField(frontMatter, 'source');
  if (!source) {
    // Many older pages have no source field; derive the official URL from the
    // mirrored path instead of skipping the page.
    const route = rel.replace(/\.md$/i, '').replace(/\/index$/, '');
    source = `https://manual.mikrotik.com/docs/${VERSION}/${route}`;
  }
  try {
    const html = await fetchHtml(source.endsWith('/') ? source : `${source}/`);
    const $ = cheerio.load(html);
    const htmlTables = $('main table, article table, table').toArray();
    const lines = body.split('\n');
    const tables = mdTables(lines);
    if (!tables.length || !htmlTables.length) return;
    stats.pages++;
    let pageChanged = false;
    const limit = Math.min(tables.length, htmlTables.length);
    for (let t = 0; t < limit; t++) {
      const md = tables[t];
      const htmlTable = htmlTables[t];
      const htmlRows = $(htmlTable).find('tr').toArray();
      const mdRows = [md.header, ...md.rows];
      if (htmlRows.length !== mdRows.length) continue;
      stats.tables++;
      for (let r = 0; r < mdRows.length; r++) {
        const mdCells = splitRow(mdRows[r]);
        const htmlCells = $(htmlRows[r]).find('th,td').toArray();
        if (htmlCells.length !== mdCells.length) continue;
        const nextCells = mdCells.slice();
        for (let c = 0; c < mdCells.length; c++) {
          const cellHtml = $(htmlCells[c]).html() || '';
          if (!/<(ul|ol|br|details)\b/i.test(cellHtml)) continue;
          // A cell that already carries local images keeps the Markdown form;
          // embedding the rendered data: URI would bloat the page for nothing.
          if (mdCells[c].includes('![') || cellHtml.includes('data:image')) continue;
          const clean = cleanCell(cellHtml, source);
          if (!clean) continue;
          const flat = mdCells[c].replace(/\s+/g, '');
          const structured = clean.replace(/\s+/g, '');
          if (flat === structured) continue;
          nextCells[c] = clean;
          stats.patchedCells++;
          pageChanged = true;
        }
        if (nextCells.join('|') !== mdCells.join('|')) {
          mdRows[r] = `| ${nextCells.join(' | ')} |`;
        }
      }
      if (pageChanged) {
        lines[md.start] = mdRows[0];
        for (let r = 0; r < md.rows.length; r++) lines[md.start + 2 + r] = mdRows[r + 1];
      }
    }
    if (pageChanged) {
      stats.changedPages++;
      changed.push(rel);
      if (APPLY) {
        const rebuilt = text.slice(0, text.indexOf(body)) + lines.join('\n');
        fs.writeFileSync(file, rebuilt);
      }
    }
  } catch (error) {
    stats.failed++;
    console.log('FAILED', rel, error.message);
  }
}

let cursor = 0;
const files = walk(path.join(REPO, DIR)).filter((file) => !PAGE || file.includes(PAGE));
async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= files.length || (LIMIT && index >= LIMIT)) return;
    await processPage(files[index]);
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, worker));

console.log(JSON.stringify({version: VERSION, apply: APPLY, ...stats}, null, 1));
console.log(changed.slice(0, 20));
