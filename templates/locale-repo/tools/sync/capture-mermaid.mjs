#!/usr/bin/env node
/**
 * Capture the authoritative Mermaid sources from the rendered pages.
 *
 * The official `.md` export (our `upstream/`) is lossy: HTML inside a diagram
 * label is stripped. For example the point-to-point diagram on
 * `getting-started/networking-fundamentals` ships
 *
 *     H1["**Host 1**<br />____________________<br /> **Address**: ..."]
 *
 * on the page, but the markdown export contains the same text without the
 * `<br />` tags, so the label reflows and the box overflows. The rendered page
 * is what readers see, so it wins.
 *
 * Only pages that already contain a mermaid fence are fetched.
 *
 *   node tools/sync/capture-mermaid.mjs --version=7.24
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {REPO} from '../translate/lib/paths.mjs';
import {allVersions, versionPlan} from './lib/versions.mjs';
import {fetchUrlFor} from './lib/upstream.mjs';

const docsDir = (version) => path.join(REPO, versionPlan(version).docsDir);

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

const args = process.argv.slice(2);
const versionArg = args.find((arg) => arg.startsWith('--version='))?.split('=')[1];
const versions = versionArg ? [versionArg] : allVersions();

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

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

function decode(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function mermaidSources(html) {
  const $ = cheerio.load(html);
  return $('pre.mermaid-plain, pre.mermaid')
    .map((_, element) => $(element).text())
    .get()
    .map((text) => text.replace(/\n+$/, ''));
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
  const pages = walk(docsDir(version)).filter((file) =>
    /^\s*```mermaid\s*$/m.test(fs.readFileSync(file, 'utf8')),
  );
  const out = {};
  let failed = 0;
  for (const file of pages) {
    const id = path.relative(docsDir(version), file).replace(/\.mdx?$/, '');
    const url = pageUrl(version, file);
    try {
      const sources = mermaidSources(await fetchText(url));
      if (sources.length) out[id] = sources;
    } catch (error) {
      failed++;
      console.warn(`[${version}] ${id}: ${error.message}`);
    }
  }
  const target = path.join(REPO, `data/manifests/docs-${version}-mermaid.json`);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify({version, generated: new Date().toISOString(), pages: out}, null, 1)}\n`);
  const diagrams = Object.values(out).reduce((sum, list) => sum + list.length, 0);
  console.log(`[${version}] ${pages.length} pages with mermaid, ${Object.keys(out).length} captured, ${diagrams} diagrams, ${failed} failed`);
}
