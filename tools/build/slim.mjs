#!/usr/bin/env node
/**
 * Shrink the Docusaurus output for GitHub Pages.
 *
 * ## Monolingual output
 *
 * This repository builds English only (`SITE_LOCALE=en`, see
 * `tools/build/index.mjs`), so `build/` has no `<locale>/` subdirectory at all:
 * `detectLocales` returns an empty list, the per-locale deletion and URL
 * rewriting below do nothing, and the English `build/assets/images` /
 * `build/assets/files` are never touched. Only the `build/img` prune (and the
 * `llms-full.txt` inventory) still run. A bilingual build keeps the old
 * behaviour; the produced locale of this deployment (`SITE_LOCALE`) is never a
 * deletion target even if a stale directory with that name exists.
 *
 * In a bilingual build Docusaurus copies every static asset into each locale
 * tree, so `build/zh-Hans` carries byte-identical copies of `build/img`,
 * `build/assets/images` and `build/assets/files`. Those copies are what push the
 * Pages artifact past the deployment budget. The step deletes them and rewrites
 * the locale-prefixed absolute URLs in HTML/XML/JSON so pages keep pointing at
 * the root copies.
 *
 * It keeps the per-locale `llms-full.txt` files: the plugin writes one full
 * corpus per locale (and per docs version), `llms.txt` in the same directory
 * links to it, and the site's introduction page advertises `/llms-full.txt`.
 * Losing that file is a 404 for every reader that follows the advertised
 * corpus link. A versioned full text is only removed when no `llms.txt` links
 * to it (reported as `unreferenced`, never silent).
 *
 * ## Shared asset origin
 *
 * `ASSET_ORIGIN` (see `guides/CI.md`) means this deployment does not publish
 * `static/` at all: every `/img/…`, `/assets/…`, `/videos/…`, `/official/…`,
 * `/cli/…` reference is an **absolute URL on the English site**, and `build/`
 * has no `img/` (nor `assets/images` / `assets/files` from `static/`). In that
 * mode there is nothing to prune: the step counts the external references it
 * still sees and reports `external assets: N refs` instead of failing on an
 * empty image scan. `ASSET_ORIGIN` can be passed as `--asset-origin=<url>`.
 *
 * ## Asset host
 *
 * `ASSET_HOST=true` marks this build as the **asset host** for localized
 * sites. Those sites reference `static/` files through `ASSET_ORIGIN`
 * (`/img/…`, `/assets/…`, …), including Markdown images — which this site
 * serves from the Webpack-emitted `assets/images/` copy, not from `/img/`.
 * Pruning `build/img` would therefore 404 every localized Markdown image, so
 * the whole `static/img` tree is kept instead. It costs ~88 MiB in the deploy
 * artifact and is opt-in (`ASSET_HOST`); without it the English site keeps the
 * historical prune.
 *
 * Finally it drops the `build/img` blobs no built file requests. `static/img`
 * is the content-addressed source of every picture, and Docusaurus copies the
 * whole directory into the output; but a Markdown image is *required* through
 * the MDX loader and served from `build/assets/images`, so its `/img/<hash>`
 * copy is a duplicate the browser never loads. Only `<Img src>` / `<img src>`
 * (the hardware pages) and the config's logo/favicon actually request
 * `/img/<name>`; every other blob is removed. A scan that finds no reference at
 * all aborts instead of pruning.
 *
 * Usage:
 *   node tools/build/slim.mjs [--build=build]
 *
 * The operation is idempotent: a second run deletes nothing and rewrites
 * nothing. Every deletion is resolved and checked to stay inside
 * `<build>/<locale>/{img,assets/images,assets/files}`.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCALE_RE = /^[a-z]{2}(?:-[A-Za-z]{2,})?$/;
const ASSET_SUBDIRS = ['img', path.posix.join('assets', 'images'), path.posix.join('assets', 'files')];
const TEXT_EXT = new Set(['.html', '.xml', '.json']);
/**
 * Files that can *request* an image: the page HTML, the JS/CSS bundles, the
 * data/feed files. `llms-full.txt` is deliberately absent even though it is
 * kept: it is a plain-text corpus, its image URLs are not browser requests,
 * and the pages that show those pictures already load them from
 * `assets/images`. Counting its links here would retain the `/img` copies the
 * step below exists to prune.
 */
const REQUEST_EXT = new Set([...TEXT_EXT, '.js', '.css']);
/** Named by `docusaurus.config.ts`; never pruned even if a scan misses them. */
const PROTECTED_IMG = new Set(['logo.svg', 'favicon.svg']);
// Directory names that are site sections, not locales, if the config cannot be
// read. `npm run build` always produces these next to the locale trees.
const RESERVED = new Set([
  'assets', 'img', 'pagefind', 'blog', 'changelog', 'docs', 'hardware',
  'cli', 'official', 'guides', 'reports',
]);

function parseArgs(argv) {
  let build = 'build';
  let pruneUnreferencedLlmsFull = false;
  let assetOrigin = String(process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '') || null;
  let assetHost = /^(?:1|true|yes)$/i.test(String(process.env.ASSET_HOST || '').trim());
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'usage: node tools/build/slim.mjs [--build=<dir>] [--asset-origin=<url>] [--asset-host]',
          '                               [--prune-unreferenced-llms-full]',
          '',
          '  --asset-origin=<url>  shared asset host (default: $ASSET_ORIGIN). When set,',
          '                        static/ assets are external: nothing is pruned and the',
          '                        external reference count is reported.',
          '  --asset-host          keep the whole build/img tree (default: $ASSET_HOST):',
          '                        localized sites load /img/… Markdown images from here.',
        ].join('\n'),
      );
      process.exit(0);
    }
    if (arg.startsWith('--build=')) build = arg.slice('--build='.length);
    else if (arg.startsWith('--asset-origin=')) {
      assetOrigin = arg.slice('--asset-origin='.length).trim().replace(/\/+$/, '') || null;
    } else if (arg === '--asset-host') assetHost = true;
    else if (arg === '--prune-unreferenced-llms-full') pruneUnreferencedLlmsFull = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return {
    build: path.resolve(process.cwd(), build),
    pruneUnreferencedLlmsFull,
    assetOrigin,
    assetHost,
  };
}

/** Count `${origin}/img|assets|videos|official|cli/…` occurrences in the output. */
function countExternalAssetRefs(root, origin) {
  const pattern = new RegExp(
    `${escapeRegExp(origin)}/(?:img|assets|videos|official|cli)/[^\\s"'\`<>\\\\]+`,
    'g',
  );
  let refs = 0;
  walk(root, (file) => {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) return;
    for (const _match of fs.readFileSync(file, 'utf8').matchAll(pattern)) refs += 1;
  });
  return refs;
}

function looksLikeLocaleDir(name) {
  return LOCALE_RE.test(name) && !RESERVED.has(name);
}

function hasLocaleContent(root, name) {
  return (
    fs.existsSync(path.join(root, name, 'docs')) ||
    fs.existsSync(path.join(root, name, 'index.html'))
  );
}

/** Non-default locale output directories that actually exist. */
function detectLocales(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`build directory not found: ${root}`);
  }
  const config = resolveLocales();
  const names = [];
  // The locale this deployment is built from: its tree is the site root, never
  // a "duplicate" to slim. Defaults to the registry's default locale.
  const producedLocale = (process.env.SITE_LOCALE || '').trim();
  for (const locale of config.locales) {
    if (locale === config.defaultLocale) continue;
    if (producedLocale && locale === producedLocale) continue;
    if (fs.existsSync(path.join(root, locale)) && hasLocaleContent(root, locale)) {
      names.push(locale);
    }
  }
  if (names.length === 0) {
    // Fallback: any locale-looking directory that contains a real locale build.
    for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
      if (!entry.isDirectory() || !looksLikeLocaleDir(entry.name)) continue;
      if (hasLocaleContent(root, entry.name)) names.push(entry.name);
    }
  }
  return [...new Set(names)];
}

function walk(root, visit) {
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

function treeBytes(dir) {
  let bytes = 0;
  let files = 0;
  walk(dir, (file) => {
    bytes += fs.lstatSync(file).size;
    files += 1;
  });
  return {bytes, files};
}

/** Resolve `<build>/<locale>/<sub>` and refuse anything else. */
function safeLocaleAssetPath(root, locale, sub) {
  const expected = path.resolve(root, locale, sub);
  const rel = path.relative(root, expected);
  const wanted = path.join(locale, sub);
  if (rel !== wanted || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`refusing unsafe path outside build/${locale}: ${expected}`);
  }
  const stat = fs.lstatSync(expected);
  if (stat.isSymbolicLink()) {
    throw new Error(`refusing symlinked asset directory: ${expected}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`not a directory: ${expected}`);
  }
  return expected;
}

function assertInside(root, file) {
  const rel = path.relative(root, file);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`refusing path outside build root: ${file}`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LLMS_INDEX = 'llms.txt';
const LLMS_FULL = 'llms-full.txt';
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

/** Deployment baseUrl (e.g. `/mikrotik_manual_i18n/`); `/` if unreadable. */
function deploymentBasePath() {
  try {
    return normalizeBaseUrl(resolveBaseUrl().value);
  } catch {
    return '/';
  }
}

/**
 * Build-relative path for a URL/path in this deployment, or null when the
 * value is external (another origin, an anchor, a relative link).
 */
function buildRelativeUrlPath(raw, basePath) {
  const value = String(raw || '').trim();
  if (!value) return null;
  let pathname;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  } else if (value.startsWith('/')) {
    pathname = value.split(/[?#]/, 1)[0];
  } else {
    return null;
  }
  if (!pathname.startsWith(basePath)) return null;
  const suffix = pathname.slice(basePath.length);
  if (!suffix) return null;
  try {
    return decodeURIComponent(suffix);
  } catch {
    return suffix;
  }
}

/**
 * `llms.txt` files and `llms-full.txt` files under the build, plus which full
 * texts are actually linked from an index (`llms.txt`).
 */
function llmsInventory(root, basePath) {
  const indexes = [];
  const fullFiles = [];
  walk(root, (file) => {
    const name = path.basename(file);
    if (name === LLMS_INDEX) indexes.push(file);
    else if (name === LLMS_FULL) fullFiles.push(file);
  });
  const referenced = new Map();
  for (const indexFile of indexes) {
    const source = path.relative(root, indexFile).split(path.sep).join('/');
    const text = fs.readFileSync(indexFile, 'utf8');
    for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
      const rel = buildRelativeUrlPath(match[1], basePath);
      if (!rel || path.basename(rel) !== LLMS_FULL) continue;
      if (!referenced.has(rel)) referenced.set(rel, []);
      referenced.get(rel).push(source);
    }
  }
  return {indexes, fullFiles, referenced};
}

function main() {
  const {build, pruneUnreferencedLlmsFull, assetOrigin, assetHost} =
    parseArgs(process.argv.slice(2));
  const root = path.resolve(build);
  const locales = detectLocales(root);
  if (locales.length === 0) {
    console.error(
      'slim: monolingual build (no locale subdirectories): ' +
        'nothing to delete or rewrite under a locale tree; ' +
        (assetOrigin
          ? 'assets are external (ASSET_ORIGIN)'
          : assetHost
            ? 'asset host: build/img is kept in full'
            : 'only build/img is pruned'),
    );
  }
  const localePatterns = locales.map((locale) => ({
    locale,
    re: new RegExp(`/${escapeRegExp(locale)}/(img|assets/(?:images|files))/`, 'g'),
    replacement: '/$1/',
  }));

  let deletedDirectories = 0;
  let deletedBytes = 0;
  const deleted = [];

  for (const locale of locales) {
    for (const sub of ASSET_SUBDIRS) {
      const target = path.join(root, locale, sub);
      if (!fs.existsSync(target)) continue;
      const safe = safeLocaleAssetPath(root, locale, sub);
      const {bytes, files} = treeBytes(safe);
      fs.rmSync(safe, {recursive: true, force: true});
      deletedDirectories += 1;
      deletedBytes += bytes;
      deleted.push({path: `${locale}/${sub}`, files, bytes});
    }
  }

  // `llms-full.txt` is a per-locale (and per-version) deliverable, not a
  // duplicate: the plugin writes it next to the `llms.txt` that links to it,
  // and the introduction page advertises the root one. Keep the root copy and
  // every `<locale>/llms-full.txt`; a versioned copy is only dropped when no
  // `llms.txt` in the build links to it, and even then only on explicit
  // request (`--prune-unreferenced-llms-full`) because deleting a corpus is not
  // a size decision this step may make silently.
  const basePath = deploymentBasePath();
  const {
    indexes: llmsIndexFiles,
    fullFiles: llmsFullFiles,
    referenced: llmsFullReferences,
  } = llmsInventory(root, basePath);
  const keptLlmsFull = [];
  const removedLlmsFull = [];
  const unreferencedLlmsFull = [];
  for (const file of llmsFullFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const bytes = fs.lstatSync(file).size;
    const segments = rel.split('/');
    const isLocaleRoot = segments.length <= 2;
    const referencedBy = llmsFullReferences.get(rel) || [];
    if (isLocaleRoot || referencedBy.length > 0) {
      keptLlmsFull.push({
        path: rel,
        bytes,
        reason: isLocaleRoot ? 'locale-root' : 'referenced',
        ...(referencedBy.length > 0 ? {referencedBy} : {}),
      });
      continue;
    }
    const entry = {path: rel, bytes, reason: 'unreferenced'};
    if (pruneUnreferencedLlmsFull) {
      assertInside(root, file);
      fs.rmSync(file, {force: true});
      removedLlmsFull.push(entry);
    } else {
      unreferencedLlmsFull.push(entry);
    }
  }
  const llmsFullKeptBytes = keptLlmsFull.reduce((sum, item) => sum + item.bytes, 0);
  const llmsFullRemovedBytes = removedLlmsFull.reduce((sum, item) => sum + item.bytes, 0);
  console.error(
    `slim: llms-full kept ${keptLlmsFull.length} file(s) (${llmsFullKeptBytes} bytes), ` +
      `removed ${removedLlmsFull.length} file(s) (${llmsFullRemovedBytes} bytes)` +
      (unreferencedLlmsFull.length
        ? `, ${unreferencedLlmsFull.length} unreferenced file(s) kept (pass --prune-unreferenced-llms-full to delete: ${unreferencedLlmsFull
            .map((item) => item.path)
            .join(', ')})`
        : ''),
  );

  let rewrittenFiles = 0;
  let rewrittenOccurrences = 0;
  let rewrittenBytesSaved = 0;
  const textFiles = [];
  walk(root, (file) => {
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) textFiles.push(file);
  });
  for (const file of textFiles) {
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (const {re} of localePatterns) after = after.replace(re, '/$1/');
    if (after === before) continue;
    const occurrences = localePatterns.reduce(
      (sum, {re}) => sum + (before.match(re)?.length ?? 0),
      0,
    );
    fs.writeFileSync(file, after);
    rewrittenFiles += 1;
    rewrittenOccurrences += occurrences;
    rewrittenBytesSaved += Buffer.byteLength(before) - Buffer.byteLength(after);
  }

  // A picture that a Markdown page shows is *required* by the MDX loader and
  // emitted as `assets/images/<name>-<contenthash>.<ext>`; the `/img/<hash>`
  // copy under `build/img` is only for references Webpack never sees —
  // `<Img src>` / `<img src>` on the hardware pages. With the corpus
  // content-addressed, Docusaurus copies the whole of `static/img` (95 MiB) into
  // `build/img` while Markdown pages load the `assets/images` copy, so the rest
  // is a second copy of a file the browser already downloaded. Drop exactly the
  // files no page, bundle or feed asks for; a referenced file is never touched,
  // and an empty scan is a failure, never "delete everything".
  //
  // Shared asset origin: the deployment publishes no `static/`, so `build/img`
  // does not exist and every asset reference is an absolute URL on the hub
  // site. There is nothing to prune or restore; count the external references
  // so the deploy log still shows the assets are wired up.
  let prunedImgFiles = 0;
  let prunedImgBytes = 0;
  let scannedRequestFiles = 0;
  let externalAssetRefs = 0;
  let referencedImageCount = 0;
  const restoredImgFiles = [];
  const imgRoot = path.join(root, 'img');
  if (assetOrigin) {
    externalAssetRefs = countExternalAssetRefs(root, assetOrigin);
    console.error(
      `slim: external assets: ${externalAssetRefs} refs (ASSET_ORIGIN=${assetOrigin}); ` +
        'build/img and static/ asset copies are not published by this deployment',
    );
    if (fs.existsSync(imgRoot)) {
      console.error('slim: note: build/img exists although ASSET_ORIGIN is set; left untouched');
    }
  } else if (assetHost) {
    // The hub site for localized deployments: it must keep every `/img/<name>`
    // because localized pages load Markdown images from there (this site's own
    // pages use the `assets/images` copies Webpack emits).
    if (!fs.existsSync(imgRoot)) {
      throw new Error('refusing to mark this build as asset host: build/img does not exist');
    }
    const kept = treeBytes(imgRoot);
    referencedImageCount = kept.files;
    console.error(
      `slim: asset host: kept ${kept.files} build/img file(s) (${kept.bytes} bytes) ` +
        'so localized sites can load /img/… (pruning disabled)',
    );
  } else {
    if (!fs.existsSync(imgRoot)) {
      throw new Error(
        'refusing to prune build/img: the directory does not exist. ' +
          'A localized build without static/ must set ASSET_ORIGIN (or --asset-origin).',
      );
    }
    const referencedImages = new Set();
    walk(root, (file) => {
      if (!REQUEST_EXT.has(path.extname(file).toLowerCase())) return;
      scannedRequestFiles += 1;
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/\/img\/([A-Za-z0-9._%+-]+)/g)) referencedImages.add(match[1]);
    });
    if (scannedRequestFiles === 0 || referencedImages.size === 0) {
      throw new Error(`refusing to prune build/img: the reference scan found ${referencedImages.size} name(s) in ${scannedRequestFiles} file(s)`);
    }
    // `static/img` is the source of every `/img/<name>`; Docusaurus copies it
    // wholesale, but a referenced picture can be absent from the output
    // (observed on the zh-Hans hardware page: an `<Img>` URL the pages request
    // never got a copy, so the deploy gate found a 404). A URL a page actually
    // requests is part of the site, not a pruning decision: restore it from
    // `static/img` before the prune below instead of shipping a broken image.
    const staticImgRoot = path.join(REPO, 'static', 'img');
    for (const name of referencedImages) {
      const target = path.join(imgRoot, name);
      if (fs.existsSync(target)) continue;
      const source = path.join(staticImgRoot, name);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      fs.copyFileSync(source, target);
      restoredImgFiles.push(name);
    }
    if (restoredImgFiles.length > 0) {
      console.error(
        `slim: restored ${restoredImgFiles.length} referenced img file(s) absent from the build: ` +
          restoredImgFiles.join(', '),
      );
    }
    for (const entry of fs.readdirSync(imgRoot, {withFileTypes: true})) {
      if (!entry.isFile() || PROTECTED_IMG.has(entry.name) || referencedImages.has(entry.name)) continue;
      const file = path.join(imgRoot, entry.name);
      assertInside(root, file);
      prunedImgBytes += fs.lstatSync(file).size;
      fs.rmSync(file, {force: true});
      prunedImgFiles += 1;
    }
    externalAssetRefs = 0;
    referencedImageCount = referencedImages.size;
  }

  let remainingBytes = 0;
  let remainingFiles = 0;
  walk(root, (file) => {
    remainingBytes += fs.lstatSync(file).size;
    remainingFiles += 1;
  });

  console.log(JSON.stringify({
    build: path.relative(REPO, root) || '.',
    locales,
    deletedDirectories,
    deletedBytes,
    deleted,
    llmsFull: {
      indexes: llmsIndexFiles
        .map((file) => path.relative(root, file).split(path.sep).join('/'))
        .sort(),
      keptFiles: keptLlmsFull.length,
      keptBytes: llmsFullKeptBytes,
      removedFiles: removedLlmsFull.length,
      removedBytes: llmsFullRemovedBytes,
      unreferenced: unreferencedLlmsFull,
      kept: keptLlmsFull,
      removed: removedLlmsFull,
    },
    rewrittenFiles,
    rewrittenOccurrences,
    rewrittenBytesSaved,
    assetOrigin,
    assetHost,
    externalAssetRefs,
    referencedImages: referencedImageCount,
    restoredImgFiles,
    prunedImgFiles,
    prunedImgBytes,
    remainingFiles,
    remainingBytes,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`slim: ${error.message}`);
  process.exit(1);
}
