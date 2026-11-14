#!/usr/bin/env node
/**
 * Capture the coloured inline codes the official pages put inside table cells.
 *
 * The `.md` export drops the surrounding markup, so a table cell that reads
 *
 *     <span style="color:var(--ds-icon-success,#22a06b)"><code>root-port</code></span>
 *
 * on the page arrives here as a bare `<code>root-port</code>`. The colour is
 * meaningful (it marks enumeration values), so recover it from the rendered
 * tables and let `materialize` re-wrap the same codes.
 *
 *   node tools/sync/capture-inline-colors.mjs --version=7.24
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {REPO} from '../translate/lib/paths.mjs';
import {allVersions, versionPlan} from './lib/versions.mjs';
import {fetchUrlFor} from './lib/upstream.mjs';

const docsDir = (version) => path.join(REPO, versionPlan(version).docsDir);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

const args = process.argv.slice(2);
const versionArg = args.find((arg) => arg.startsWith('--version='))?.split('=')[1];
const versions = versionArg ? [versionArg] : allVersions();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function pageUrl(version, file) {
  const rel = path.relative(docsDir(version), file).replace(/\\/g, '/');
  return fetchUrlFor(versionPlan(version), rel);
}

/** `--ds-icon-success` -> `icon-success`; unknown variables keep their fallback hex. */
function colorKey(variable, hex) {
  if (variable) return variable.replace(/^--ds-/, '');
  return `hex-${hex.replace('#', '').toLowerCase()}`;
}

function tableColors(html) {
  const $ = cheerio.load(html);
  const colors = {};
  $('table span').each((_, element) => {
    const style = $(element).attr('style') || '';
    const match = /color:\s*var\((--ds-[a-z-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\)/.exec(style);
    if (!match) return;
    const text = $(element).text().trim();
    if (!text) return;
    // Count occurrences: `materialize` colours at most this many codes, so a
    // common word (`yes`, `disabled`) is not painted everywhere in the table.
    const existing = colors[text];
    colors[text] = existing
      ? {...existing, count: existing.count + 1}
      : {key: colorKey(match[1], match[2]), color: match[2], count: 1};
  });
  return colors;
}

async function fetchText(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {headers: {'user-agent': UA}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

for (const version of versions) {
  const pages = walk(docsDir(version)).filter((file) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    return lines.some((line) => /^\s*\|/.test(line) && /<code>|`[^`]+`/.test(line));
  });
  const out = {};
  let failed = 0;
  for (const file of pages) {
    const id = path.relative(docsDir(version), file).replace(/\.mdx?$/, '');
    try {
      const colors = tableColors(await fetchText(pageUrl(version, file)));
      if (Object.keys(colors).length) out[id] = colors;
    } catch (error) {
      failed++;
      console.warn(`[${version}] ${id}: ${error.message}`);
    }
  }
  const target = path.join(REPO, `data/manifests/docs-${version}-inline-colors.json`);
  fs.writeFileSync(target, `${JSON.stringify({version, generated: new Date().toISOString(), pages: out}, null, 1)}\n`);
  const total = Object.values(out).reduce((sum, map) => sum + Object.keys(map).length, 0);
  console.log(
    `[${version}] ${pages.length} pages with code in tables, ${Object.keys(out).length} with colours, ${total} coloured codes, ${failed} failed`,
  );
}
