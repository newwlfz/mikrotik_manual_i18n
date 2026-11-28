#!/usr/bin/env node
/**
 * `npm run verify:build-image-prefix` — hub-only, targeted image-prefix gate.
 *
 * `base-url-refs` checks every root-absolute reference in the whole build, but
 * `asset-refs` / `orphan-assets` only check that the referenced file exists in
 * `build/`. A Markdown image rendered as a bare `/img/<hash>` therefore passes
 * those gates while 404ing from a sub-path deployment (`/mikrotik_manual_i18n/`).
 * This gate narrows the assertion to where that regression actually lives:
 * `<img src>` in blog and hardware HTML.
 *
 * Scan `build/blog/**\/*.html` and `build/hardware/**\/*.html` and require every
 * root-absolute `src` (single leading `/`) to start with the deployment baseUrl.
 * The baseUrl comes from `BASE_URL`, else from the path of `SITE_URL`, else
 * defaults to `/mikrotik_manual_i18n/`. Protocol-relative URLs (`//host/...`)
 * and relative/absolute URLs are out of scope. Nothing is relaxed: a bare root
 * reference is a failure, and a missing source directory is also a failure.
 *
 * Exit 0 iff there are no bare root-absolute image sources.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD = path.join(REPO, 'build');
const DIRS = ['blog', 'hardware'];
const DEFAULT_BASE_URL = '/mikrotik_manual_i18n/';

/** `/prefix`, `prefix/` and `/prefix/` all become `/prefix/`. */
function normalizeBaseUrl(value) {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '/';
  return `${trimmed.startsWith('/') ? '' : '/'}${trimmed}/`;
}

function deriveBaseUrl() {
  const fromBaseUrl = process.env.BASE_URL?.trim();
  if (fromBaseUrl) return normalizeBaseUrl(fromBaseUrl);
  const fromSiteUrl = process.env.SITE_URL?.trim();
  if (fromSiteUrl) {
    try {
      const pathname = new URL(fromSiteUrl).pathname;
      if (pathname && pathname !== '/') return normalizeBaseUrl(pathname);
    } catch {
      // An unparsable SITE_URL falls through to the documented default.
    }
  }
  return DEFAULT_BASE_URL;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** The `src` of one `<img ...>` tag, or null when it has none. */
function imageSrc(tag) {
  for (const match of tag.matchAll(ATTR_RE)) {
    if (match[1].toLowerCase() === 'src') return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return null;
}

const baseUrl = deriveBaseUrl();
const files = [];
const missing = [];
for (const dir of DIRS) {
  const abs = path.join(BUILD, dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    missing.push(`build/${dir}`);
    continue;
  }
  files.push(...walk(abs));
}
files.sort();

const bare = [];
let images = 0;
const TAG_RE = /<img\b[^>]*>/gi;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(BUILD, file);
  for (const tag of content.matchAll(TAG_RE)) {
    images += 1;
    const src = imageSrc(tag[0]);
    if (src === null) continue;
    // Single-slash root-absolute, but not already under the deployment prefix.
    if (!src.startsWith('/') || src.startsWith('//') || src.startsWith(baseUrl)) continue;
    bare.push({file: rel, src});
  }
}

console.log('verify:build-image-prefix  <img src> in blog/ and hardware/ must carry baseUrl');
console.log(`  baseUrl                ${baseUrl}`);
console.log(`  files scanned         ${files.length}`);
console.log(`  <img> tags            ${images}`);
console.log(`  bare "/" sources      ${bare.length}`);
if (missing.length) {
  console.error(`verify:build-image-prefix: missing build directories: ${missing.join(', ')}`);
  process.exit(1);
}
if (bare.length) {
  for (const hit of bare.slice(0, 20)) console.error(`  ${hit.file}: ${hit.src}`);
  if (bare.length > 20) console.error(`  ... and ${bare.length - 20} more`);
  console.error(
    `verify:build-image-prefix: ${bare.length} bare root-absolute image source(s); ` +
      'expected every <img src> to start with the deployment baseUrl.',
  );
  process.exit(1);
}
console.log('verify:build-image-prefix: OK — no bare root-absolute image sources.');
