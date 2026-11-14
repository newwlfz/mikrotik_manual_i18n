#!/usr/bin/env node
/**
 * Point the PDF links at real files and cache those files in the mirror.
 *
 * The `.md` export writes `/assets/files/<slug>.pdf`, but the site serves
 * `<slug>-<hash>.pdf`; every such link is a 404 on both sites. The capture stage
 * records the real URL, this one rewrites the Markdown and downloads the file
 * into `static/assets/files/`, the same way images are mirrored.
 *
 * The rewrite is idempotent. A link may arrive as the exported slug
 * (`<slug>.pdf`), as the resolved name (`<slug>-<hash>.pdf`), or as the
 * double-hash artifact of an older run (`<slug>-<hash>-<hash>.pdf`); all three
 * normalize to the one-hashed name recorded in the manifest, so a second
 * `--apply` run reports `files: 0`. Locale-prefixed links
 * (`/zh-Hans/assets/files/…`) are folded to the root mirror at the same time.
 *
 * The link is then written as a raw HTML anchor rather than a Markdown link:
 * `mdx-loader`'s `transformLinks` rewrites a Markdown link to a repository file
 * into a `require()`, and the `otherAssets` loader appends a *second* content
 * hash to the already hashed attachment name. See
 * `tools/translate/lib/pdf-links.mjs` for the form and the reason.
 *
 *   node tools/sync/sync-pdfs.mjs            # report only
 *   node tools/sync/sync-pdfs.mjs --apply    # rewrite links + download
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {anchorPdfLinks, countMarkdownPdfLinks} from '../translate/lib/pdf-links.mjs';

const APPLY = process.argv.includes('--apply');
const MAP_FILE = path.join(REPO, 'data/manifests/hardware-pdf.json');
const STATIC_DIR = path.join(REPO, 'static/assets/files');
if (!fs.existsSync(MAP_FILE)) {
  console.log('missing data/manifests/hardware-pdf.json; run capture-pdf-links first');
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

const HASH_SUFFIX_RE = /-[0-9a-f]{32}$/;
const DOUBLE_HASH_RE = /-([0-9a-f]{32})-\1\.pdf$/;
// A link may carry a locale prefix (`/zh-Hans/assets/files/…`) left by a
// locale-scoped build; the mirror is always the root `static/assets/files`.
const PDF_LINK_RE = /(?:\/[a-z]{2}(?:-[A-Za-z]{2,})?)?\/assets\/files\/([^\s"'`()<>[\]{}\\]+?\.pdf)/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.name.endsWith('.md')) out.push(file);
  }
  return out;
}

// A page can link a sibling product's PDF (the export copies the link from
// another model), so the full manifest is the lookup table, not one page.
// `exportedMap` keeps the literal export name; `stemMap` keys the hashed real
// name by its hash-free stem so `<stem>.pdf`, `<stem>-<hash>.pdf` and
// `<stem>-<hash>-<hash>.pdf` all resolve to the same file.
const exportedMap = new Map();
const stemMap = new Map();
const urlByName = new Map();
for (const page of Object.values(manifest.pages)) {
  for (const [exported, url] of Object.entries(page)) {
    const real = decodeURIComponent(new URL(url).pathname.split('/').pop());
    exportedMap.set(exported, real);
    stemMap.set(real.replace(/\.pdf$/, '').replace(HASH_SUFFIX_RE, ''), real);
    urlByName.set(real, url);
  }
}

function resolvePdfName(name) {
  const exported = exportedMap.get(name);
  if (exported) return exported;
  let stem = name.replace(/\.pdf$/, '');
  for (let guard = 0; guard < 4 && HASH_SUFFIX_RE.test(stem); guard += 1) {
    stem = stem.replace(HASH_SUFFIX_RE, '');
  }
  return stemMap.get(stem) ?? null;
}

const targets = [
  ...walk(path.join(REPO, 'hardware')),
  ...walk(path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current')),
];

const wanted = new Map();
let rewritten = 0;
let anchored = 0;
for (const file of targets) {
  const text = fs.readFileSync(file, 'utf8');
  const resolved = text.replace(PDF_LINK_RE, (match, name) => {
    const real = resolvePdfName(name);
    if (real) wanted.set(real, urlByName.get(real));
    // Unresolved links keep their name but still lose the locale prefix.
    return `/assets/files/${real ?? name}`;
  });
  // A Markdown link to the attachment would be turned into a `require()` by
  // `mdx-loader`, which re-hashes the already hashed file name. Write the
  // anchor form instead; it is idempotent, so a second run finds nothing.
  const next = anchorPdfLinks(resolved);
  if (next !== resolved) anchored += countMarkdownPdfLinks(resolved) - countMarkdownPdfLinks(next);
  if (next === text) continue;
  rewritten++;
  if (APPLY) fs.writeFileSync(file, next);
}

// Retire double-hash copies left by older runs: drop the duplicate when the
// one-hashed file exists, otherwise rename it back to the real name.
let cleaned = 0;
let renamed = 0;
if (APPLY && fs.existsSync(STATIC_DIR)) {
  for (const name of fs.readdirSync(STATIC_DIR)) {
    const match = DOUBLE_HASH_RE.exec(name);
    if (!match) continue;
    const base = name.replace(DOUBLE_HASH_RE, `-${match[1]}.pdf`);
    const duplicate = path.join(STATIC_DIR, name);
    const target = path.join(STATIC_DIR, base);
    if (fs.existsSync(target)) {
      fs.unlinkSync(duplicate);
      cleaned++;
    } else {
      fs.renameSync(duplicate, target);
      renamed++;
    }
  }
}

const missing = APPLY
  ? []
  : [...wanted.keys()].filter((name) => !fs.existsSync(path.join(STATIC_DIR, name)));

let downloaded = 0;
let bytes = 0;
if (APPLY) {
  fs.mkdirSync(STATIC_DIR, {recursive: true});
  for (const [name, url] of wanted) {
    const target = path.join(STATIC_DIR, name);
    if (fs.existsSync(target) && fs.statSync(target).size > 1024) continue;
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) throw new Error('suspiciously small file');
      fs.writeFileSync(target, buffer);
      downloaded++;
      bytes += buffer.length;
      console.log(`fetched ${name} (${Math.round(buffer.length / 1024)} KiB)`);
    } catch (error) {
      console.warn(`failed ${name}: ${error.message}`);
    }
  }
}

console.log(JSON.stringify({
  apply: APPLY,
  files: rewritten,
  anchored,
  pdfs: wanted.size,
  downloaded,
  bytes,
  removed: cleaned,
  renamed,
  missingLocal: missing.length,
}));
