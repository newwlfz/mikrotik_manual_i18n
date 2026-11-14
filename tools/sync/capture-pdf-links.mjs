#!/usr/bin/env node
/**
 * Recover the real PDF file names for the Hardware Guides.
 *
 * The official pages say "This guide can be downloaded as a PDF file" and link
 * `/assets/files/<slug>.pdf`, but the `.md` export drops the content hash the
 * site actually serves (`<slug>-<hash>.pdf`). Every such link on the mirror is
 * therefore a 404, on the official site too.
 *
 * This capture reads the rendered page and records the real href per exported
 * path, so materialisation can rewrite the link and the downloader can fetch it.
 *
 *   node tools/sync/capture-pdf-links.mjs            # all hardware pages
 *   node tools/sync/capture-pdf-links.mjs --refresh  # ignore the cache
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, WORKSPACE} from '../translate/lib/paths.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const REFRESH = process.argv.includes('--refresh');
const OUT = path.join(REPO, 'data/manifests/hardware-pdf.json');
const BASE = 'https://manual.mikrotik.com';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.name.endsWith('.md')) out.push(file);
  }
  return out;
}

const pages = walk(path.join(REPO, 'hardware'))
  .map((file) => ({
    file,
    rel: path.relative(path.join(REPO, 'hardware'), file),
    text: fs.readFileSync(file, 'utf8'),
  }))
  .filter((page) => /assets\/files\/[^)\s"]*\.pdf/.test(page.text));

if (!pages.length) {
  console.log('no hardware page references a PDF');
  process.exit(0);
}

const manifest = REFRESH || !fs.existsSync(OUT)
  ? {schema: 1, generated_at: new Date().toISOString(), pages: {}}
  : JSON.parse(fs.readFileSync(OUT, 'utf8'));

let updated = 0;
for (const page of pages) {
  const source = /^source:\s*(\S+)/m.exec(page.text)?.[1];
  const url = source ? source.replace(/\.md$/, '') : null;
  if (!url) continue;
  if (!REFRESH && manifest.pages[url]) continue;
  try {
    const response = await fetch(url, {
      headers: {'user-agent': 'mikrotik-manual-i18n/2.0'},
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const hrefs = [...html.matchAll(/href=["']?([^"'\s>]*assets\/files\/[^"'\s>]+\.pdf)["']?/g)].map((match) => match[1]);
    const map = {};
    for (const href of hrefs) {
      const base = path.basename(href);
      // `<slug>-<hash>.pdf` belongs to the exported `<slug>.pdf`.
      const match = /^(.*?)-[0-9a-f]{16,}\.pdf$/.exec(base);
      const exported = match ? `${match[1]}.pdf` : base;
      map[exported] = href.startsWith('http') ? href : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;
    }
    if (!Object.keys(map).length) {
      console.warn(`no pdf href on ${url}`);
      continue;
    }
    manifest.pages[url] = map;
    updated++;
    console.log(`${page.rel}: ${Object.keys(map).length} pdf`);
  } catch (error) {
    console.warn(`skip ${page.rel}: ${error.message}`);
  }
}

manifest.generated_at = new Date().toISOString();
fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(JSON.stringify({pages: Object.keys(manifest.pages).length, updated, out: path.relative(REPO, OUT)}));
