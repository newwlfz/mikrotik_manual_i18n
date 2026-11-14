#!/usr/bin/env node
/**
 * Assert that the built site no longer references per-locale asset copies, and
 * that every mirrored PDF name is the single-hashed one the site actually
 * serves.
 *
 * `tools/build/slim.mjs` deletes `build/<locale>/{img,assets/images,assets/files}`
 * and rewrites those URLs to the root copies. This check fails if a locale
 * prefix survives, if any `/img/…`, `/assets/images/…` or `/assets/files/…`
 * reference points at a file that does not exist, if a double-hash PDF name
 * (`<stem>-<32hex>-<32hex>.pdf`) appears in a page or in the source Markdown,
 * or if the mirror still holds such a file.
 *
 * The double hash was never produced by `tools/sync/sync-pdfs.mjs`: it comes
 * from Docusaurus' `mdx-loader`. `transformLinks` turns a Markdown link to a
 * repository file (`[PDF file](/assets/files/<stem>-<sha>.pdf)`) into a
 * `require()`, and the `@docusaurus/utils` `otherAssets` loader names the
 * emitted file `[name]-[contenthash].[ext]` — appending a second hash to an
 * attachment that is already content-addressed. The link is therefore written
 * as a raw HTML anchor, which `transformLinks` never visits; see
 * `tools/translate/lib/pdf-links.mjs`. The old non-idempotent `sync-pdfs` pass
 * could leave the same shape behind, so both a page reference and a stray
 * `static/` file are still failures.
 *
 * Usage:
 *   node tools/verify/asset-refs.mjs [--build=build]
 *
 * Exit code is 1 on a locale-prefixed reference, a double-hash PDF, or a
 * missing file.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, resolveBaseUrl} from '../lib/site-config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEXT_EXT = new Set(['.html', '.xml']);
const LOCALE_RE = /^[a-z]{2}(?:-[A-Za-z]{2,})?$/;
const PDF_REF_RE = /\/assets\/files\/([^\s"'`<>()[\]]+\.pdf)/g;
const DOUBLE_HASH_PDF_RE = /\/assets\/files\/[^\s"'`<>\\]*?-[0-9a-f]{32}-[0-9a-f]{32}\.pdf/g;
const DOUBLE_HASH_NAME_RE = /-[0-9a-f]{32}-[0-9a-f]{32}\.pdf$/i;
const ZH_PREFIX_RE = /\/zh-Hans\/assets\/files\//;

const STATIC_FILES = path.join(REPO, 'static/assets/files');
const SOURCE_DIRS = [
  path.join(REPO, 'hardware'),
  path.join(REPO, 'i18n/zh-Hans/docusaurus-plugin-content-docs-hardware/current'),
];

// No entry today: the one upstream link with no published copy
// (`/assets/images/worddavc893…webp`) is now mirrored under the content-hashed
// name the site actually serves, so the reference resolves locally. Keep the
// mechanism for a real upstream gap; a name that a local rewrite can resolve
// must not be re-added here.
const KNOWN_MISSING = new Set();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 站点在子路径部署时，产物里的资源 URL 带 baseUrl 前缀
 * （`/mikrotik_manual_i18n/img/x`）。匹配时把前缀当可选段，解析到
 * `build/` 之前再剥掉，避免把前缀当成目录。
 */
function assetUrlPattern(baseUrl) {
  const prefix = baseUrl === '/' ? '' : `${escapeRegExp(baseUrl.replace(/\/$/, ''))}`;
  return new RegExp(
    `(?<![\\w.:-])(?:${prefix})?/(?:img|assets/(?:images|files))/[^\\s"'\`<>\\\\]+`,
    'g',
  );
}

function stripBaseUrl(url, baseUrl) {
  if (baseUrl === '/') return url;
  const bare = baseUrl.replace(/\/$/, '');
  if (url === bare) return '/';
  if (url.startsWith(`${bare}/`)) return url.slice(bare.length);
  return url;
}

function parseArgs(argv) {
  let build = 'build';
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log('usage: node tools/verify/asset-refs.mjs [--build=<dir>]');
      process.exit(0);
    }
    if (arg.startsWith('--build=')) build = arg.slice('--build='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return {build: path.resolve(process.cwd(), build)};
}

function readLocaleConfig() {
  try {
    const source = fs.readFileSync(path.join(REPO, 'docusaurus.config.ts'), 'utf8');
    const defaultMatch = source.match(/defaultLocale\s*:\s*['"]([^'"]+)['"]/);
    const localesMatch = source.match(/locales\s*:\s*\[([\s\S]*?)\]/);
    if (!localesMatch) return null;
    const locales = [...localesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (locales.length === 0) return null;
    return {defaultLocale: defaultMatch ? defaultMatch[1] : locales[0], locales};
  } catch {
    return null;
  }
}

function walk(root, visit) {
  if (!fs.existsSync(root)) return;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) visit(full);
    }
  }
}

function stripQuery(raw) {
  return raw.split('#')[0].split('?')[0].replace(/[.,;]+$/, '');
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

// Source Markdown: the links `sync-pdfs` rewrites. Assert they use the
// one-hashed name, keep no locale prefix, and resolve in the mirror.
function scanSources() {
  const mdFiles = [];
  for (const dir of SOURCE_DIRS) {
    walk(dir, (file) => {
      if (file.endsWith('.md')) mdFiles.push(file);
    });
  }
  const doubleHash = [];
  const localePrefixed = [];
  const missing = [];
  let refs = 0;
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(REPO, file);
    for (const match of content.matchAll(DOUBLE_HASH_PDF_RE)) {
      doubleHash.push(`${rel}:${lineOf(content, match.index)}: ${match[0]}`);
    }
    for (const match of content.matchAll(PDF_REF_RE)) {
      refs += 1;
      const name = decodePath(match[1]);
      if (!fs.existsSync(path.join(STATIC_FILES, name)) && !KNOWN_MISSING.has(`/assets/files/${name}`)) {
        missing.push(`${rel}:${lineOf(content, match.index)}: ${name}`);
      }
    }
    if (ZH_PREFIX_RE.test(content)) {
      const index = content.indexOf('/zh-Hans/assets/files/');
      localePrefixed.push(`${rel}:${lineOf(content, index)}: /zh-Hans/assets/files/`);
    }
  }
  return {mdFiles: mdFiles.length, refs, doubleHash, localePrefixed, missing};
}

function staticAnomalies() {
  if (!fs.existsSync(STATIC_FILES)) return [];
  return fs.readdirSync(STATIC_FILES).filter((name) => DOUBLE_HASH_NAME_RE.test(name));
}

function main() {
  const {build} = parseArgs(process.argv.slice(2));
  const root = path.resolve(build);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`build directory not found: ${root}`);
  }

  const baseUrl = normalizeBaseUrl(resolveBaseUrl().value);
  const assetUrlRe = assetUrlPattern(baseUrl);

  const config = readLocaleConfig();
  const nonDefaultLocales = config
    ? config.locales.filter((locale) => locale !== config.defaultLocale)
    : [];
  const localePrefixRe = new RegExp(
    `/(?:${(nonDefaultLocales.length > 0 ? nonDefaultLocales : ['zh-Hans'])
      .map((locale) => locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})/(?:img|assets/(?:images|files))/`,
    'g',
  );

  const files = [];
  walk(root, (file) => {
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) files.push(file);
  });

  const localeHits = [];
  const doubleHashHits = [];
  const refs = new Map(); // url path -> first source file
  let localeHitCount = 0;
  let doubleHashCount = 0;
  let refCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);

    for (const match of content.matchAll(localePrefixRe)) {
      localeHitCount += 1;
      if (localeHits.length < 10) localeHits.push(`${rel}:${lineOf(content, match.index)}: ${match[0]}`);
    }

    for (const match of content.matchAll(DOUBLE_HASH_PDF_RE)) {
      doubleHashCount += 1;
      if (doubleHashHits.length < 10) doubleHashHits.push(`${rel}:${lineOf(content, match.index)}: ${match[0]}`);
    }

    for (const match of content.matchAll(assetUrlRe)) {
      const url = stripBaseUrl(stripQuery(match[0]), baseUrl);
      if (url === '/') continue;
      refCount += 1;
      if (!refs.has(url)) refs.set(url, rel);
    }
  }

  const missing = [];
  let knownMissing = 0;
  for (const [url, source] of refs) {
    const decoded = decodePath(url);
    const target = path.resolve(root, `.${decoded}`);
    const rel = path.relative(root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      missing.push({url, source, reason: 'outside build'});
      continue;
    }
    if (fs.existsSync(target)) continue;
    if (KNOWN_MISSING.has(url)) {
      knownMissing += 1;
      continue;
    }
    missing.push({url, source, reason: 'not found'});
  }

  const sources = scanSources();
  const staticBad = staticAnomalies();
  const sourceDoubleHash = [...doubleHashHits, ...sources.doubleHash];

  console.log(`asset-refs: scanned ${files.length} html/xml files, ${refCount} refs (${refs.size} unique)`);
  console.log(`asset-refs: scanned ${sources.mdFiles} source .md files, ${sources.refs} pdf links`);
  console.log(`asset-refs: locale-prefixed asset refs = ${localeHitCount + sources.localePrefixed.length} (build ${localeHitCount}, sources ${sources.localePrefixed.length})`);
  for (const hit of [...localeHits, ...sources.localePrefixed].slice(0, 10)) console.log(`  LOCALE ${hit}`);
  console.log(`asset-refs: double-hash pdf refs = ${sourceDoubleHash.length} (build ${doubleHashCount}, sources ${sources.doubleHash.length})`);
  for (const hit of sourceDoubleHash.slice(0, 10)) console.log(`  DOUBLE-HASH ${hit}`);
  console.log(`asset-refs: double-hash pdf files in static/assets/files = ${staticBad.length}`);
  for (const name of staticBad.slice(0, 10)) console.log(`  DOUBLE-HASH-FILE ${name}`);
  console.log(`asset-refs: missing asset files = ${missing.length} (known-missing ignored: ${knownMissing})`);
  for (const item of missing.slice(0, 10)) console.log(`  MISSING ${item.url}  <- ${item.source} (${item.reason})`);
  console.log(`asset-refs: missing source pdf files = ${sources.missing.length}`);
  for (const item of sources.missing.slice(0, 10)) console.log(`  MISSING-SOURCE ${item}`);

  if (
    localeHitCount > 0 ||
    sourceDoubleHash.length > 0 ||
    staticBad.length > 0 ||
    missing.length > 0 ||
    sources.missing.length > 0
  ) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`asset-refs: ${error.message}`);
  process.exit(1);
}
