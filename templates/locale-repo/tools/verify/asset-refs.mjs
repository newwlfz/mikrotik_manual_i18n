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
 * ## Shared asset origin
 *
 * A localized repository does not ship `static/`; it publishes absolute URLs on
 * the English site (`ASSET_ORIGIN`, see `guides/CI.md`). References under that
 * origin are **external**: their existence is not checked against `build/`, but
 * they are counted and reported so a build that silently lost its asset wiring
 * is visible. Local references (including everything else in `build/`) are
 * still checked as before. `--asset-origin=<url>` overrides `$ASSET_ORIGIN`.
 * When `static/` is absent the source-PDF existence checks are skipped with a
 * note (there is nothing local to check against).
 *
 * ## Cross-repo assertion (issue 5)
 *
 * A localized build's `${ASSET_ORIGIN}/img/<name>` URLs are *external* to its
 * own `build/`, so the local existence check above cannot see them. The gap
 * that produced 1510/1702 broken images: the English host build was pruned
 * without ASSET_HOST. This tool now scans every HTML file under `build/` for those
 * URLs and checks each `<name>` against the English host's `build/img/`.
 *
 * The host build is found via `--asset-host-build=DIR`, or derived from the
 * workspace layout (`../mikrotik_manual_i18n/build`, also one level higher for
 * a template checkout). When no host build is available the check is skipped
 * with an explicit reason (a locale CI job checks out only its own repo);
 * `--skip-cross-repo` disables it even when a host build is present.
 *
 * Usage:
 *   node tools/verify/asset-refs.mjs [--build=build] [--asset-origin=<url>]
 *        [--asset-host-build=DIR] [--skip-cross-repo] [--json]
 *
 * Exit code is 1 on a locale-prefixed reference, a double-hash PDF, a missing
 * local file, or a missing cross-repo image. `--json` emits the machine-readable
 * report (see `crossRepo` fields).
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';
import {DEFAULT_TARGET_LOCALE, overlayRootFor} from '../translate/lib/paths.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TEXT_EXT = new Set(['.html', '.xml']);
const LOCALE_RE = /^[a-z]{2}(?:-[A-Za-z]{2,})?$/;
const PDF_REF_RE = /\/assets\/files\/([^\s"'`<>()[\]]+\.pdf)/g;
const DOUBLE_HASH_PDF_RE = /\/assets\/files\/[^\s"'`<>\\]*?-[0-9a-f]{32}-[0-9a-f]{32}\.pdf/g;
const DOUBLE_HASH_NAME_RE = /-[0-9a-f]{32}-[0-9a-f]{32}\.pdf$/i;

const STATIC_FILES = path.join(REPO, 'static/assets/files');
const SOURCE_DIRS = [
  path.join(REPO, 'hardware'),
  // This checkout's own hardware overlay; one shared helper, no locale literal.
  path.join(REPO, overlayRootFor(DEFAULT_TARGET_LOCALE, 'hardware')),
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
 * Translation locales come from the site registry (locales.json), not from a
 * pair of hard-coded prefixes: a new locale is covered as soon as it is added
 * there. The repository's own target locale is the read-only fallback.
 */
const LOCALES = (() => {
  try {
    const {locales, defaultLocale} = resolveLocales();
    const translated = locales.filter((locale) => locale !== defaultLocale);
    if (translated.length) return translated;
  } catch {
    /* locale registry unavailable (e.g. an unrendered template checkout) */
  }
  return [DEFAULT_TARGET_LOCALE];
})();
const LOCALE_ALT =
  LOCALES.filter((locale) => locale !== 'en' && !/\{\{|\}\}/.test(locale))
    .map((locale) => escapeRegExp(locale))
    .join('|') || '[a-z]{2,3}(?:-[A-Za-z]{2,8})*';
/** A locale-prefixed asset URL, in any configured translation locale. */
const ZH_PREFIX_RE = new RegExp(`/(?:${LOCALE_ALT})/assets/files/`, 'g');

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
  let assetOrigin = String(process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '') || null;
  let assetHostBuild = null;
  let skipCrossRepo = false;
  let json = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'usage: node tools/verify/asset-refs.mjs [--build=<dir>] [--asset-origin=<url>]',
          '       [--asset-host-build=<dir>] [--skip-cross-repo] [--json]',
          '',
          '  --asset-host-build=<dir>  English asset host build (else ../mikrotik_manual_i18n/build)',
          '  --skip-cross-repo          disable the cross-repo /img existence assertion',
          '  --json                     emit the machine-readable report',
        ].join('\n'),
      );
      process.exit(0);
    }
    if (arg.startsWith('--build=')) build = arg.slice('--build='.length);
    else if (arg.startsWith('--asset-origin=')) {
      assetOrigin = arg.slice('--asset-origin='.length).trim().replace(/\/+$/, '') || null;
    } else if (arg.startsWith('--asset-host-build=')) {
      assetHostBuild = arg.slice('--asset-host-build='.length).trim();
    } else if (arg === '--skip-cross-repo') skipCrossRepo = true;
    else if (arg === '--json') json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return {
    build: path.resolve(process.cwd(), build),
    assetOrigin,
    assetHostBuild,
    skipCrossRepo,
    json,
  };
}

/** Matches one absolute shared-asset URL (`${origin}/img/…`, `/assets/…`, …). */
function externalAssetPattern(origin) {
  return new RegExp(
    `${escapeRegExp(origin)}/(?:img|assets|videos|official|cli)/[^\\s"'\`<>\\\\]+`,
    'g',
  );
}

/** Cross-repo skip result, with the same shape as a performed check. */
function skippedCrossRepo(reason, extra = {}) {
  return {
    enabled: false,
    skipped: true,
    skipReason: reason,
    assetOrigin: extra.assetOrigin ?? null,
    assetHostBuild: null,
    hostBuildSource: null,
    htmlFilesScanned: 0,
    refs: 0,
    uniqueRefs: 0,
    found: 0,
    missing: 0,
    missingDetails: [],
  };
}

/**
 * Locate the English asset host's `build/` directory. An explicit argument
 * wins; otherwise the documented workspace layout (sibling English repo) is
 * used. `null` means "not available here" — callers skip, never guess.
 */
function resolveAssetHostBuild(arg) {
  if (arg) {
    const dir = path.resolve(process.cwd(), arg);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`--asset-host-build directory not found: ${dir}`);
    }
    return {dir, source: 'argument'};
  }
  const candidates = [
    path.resolve(REPO, '..', 'mikrotik_manual_i18n', 'build'),
    path.resolve(REPO, '..', '..', 'mikrotik_manual_i18n', 'build'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return {dir, source: `derived: ${path.relative(REPO, dir)}`};
    }
  }
  return null;
}

/**
 * Assert that every `${assetOrigin}/img/<name>` URL in a locale's HTML has a
 * matching blob in the English host build. The name character class excludes
 * `/` and `?`, so a match cannot escape `<host-build>/img/`.
 */
function checkCrossRepoRefs(root, assetOrigin, hostBuild, hostBuildSource) {
  const pattern = new RegExp(`${escapeRegExp(assetOrigin)}/img/([A-Za-z0-9._%+-]+)`, 'g');
  const htmlFiles = [];
  walk(root, (file) => {
    if (path.extname(file).toLowerCase() === '.html') htmlFiles.push(file);
  });
  const imgRoot = path.join(hostBuild, 'img');
  const hostImgExists =
    fs.existsSync(imgRoot) && fs.statSync(imgRoot).isDirectory() &&
    !fs.lstatSync(imgRoot).isSymbolicLink();
  const found = new Set();
  const missing = [];
  let refs = 0;
  for (const file of htmlFiles) {
    const source = path.relative(root, file);
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(pattern)) {
      refs += 1;
      let name = match[1];
      try {
        name = decodeURIComponent(name);
      } catch {
        /* keep the literal name */
      }
      if (found.has(name) || missing.some((item) => item.name === name)) continue;
      const target = path.join(imgRoot, name);
      if (
        hostImgExists &&
        fs.existsSync(target) &&
        fs.statSync(target).isFile() &&
        !fs.lstatSync(target).isSymbolicLink()
      ) {
        found.add(name);
      } else {
        missing.push({name, source});
      }
    }
  }
  return {
    enabled: true,
    skipped: false,
    skipReason: null,
    assetOrigin,
    assetHostBuild: hostBuild,
    hostBuildSource,
    htmlFilesScanned: htmlFiles.length,
    refs,
    uniqueRefs: found.size + missing.length,
    found: found.size,
    missing: missing.length,
    missingDetails: missing.slice(0, 20),
  };
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
  // A localized checkout has no `static/`: the PDFs live on the shared asset
  // origin, so only the link shape can be checked here, not the file.
  const canCheckLocalFiles = fs.existsSync(STATIC_FILES);
  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(REPO, file);
    for (const match of content.matchAll(DOUBLE_HASH_PDF_RE)) {
      doubleHash.push(`${rel}:${lineOf(content, match.index)}: ${match[0]}`);
    }
    for (const match of content.matchAll(PDF_REF_RE)) {
      refs += 1;
      if (!canCheckLocalFiles) continue;
      const name = decodePath(match[1]);
      if (!fs.existsSync(path.join(STATIC_FILES, name)) && !KNOWN_MISSING.has(`/assets/files/${name}`)) {
        missing.push(`${rel}:${lineOf(content, match.index)}: ${name}`);
      }
    }
    for (const match of content.matchAll(ZH_PREFIX_RE)) {
      localePrefixed.push(`${rel}:${lineOf(content, match.index)}: ${match[0]}`);
    }
  }
  return {mdFiles: mdFiles.length, refs, doubleHash, localePrefixed, missing, canCheckLocalFiles};
}

function staticAnomalies() {
  if (!fs.existsSync(STATIC_FILES)) return [];
  return fs.readdirSync(STATIC_FILES).filter((name) => DOUBLE_HASH_NAME_RE.test(name));
}

function main() {
  const {build, assetOrigin, assetHostBuild, skipCrossRepo, json} =
    parseArgs(process.argv.slice(2));
  const root = path.resolve(build);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`build directory not found: ${root}`);
  }

  const baseUrl = normalizeBaseUrl(resolveBaseUrl().value);
  const assetUrlRe = assetUrlPattern(baseUrl);
  const externalRe = assetOrigin ? externalAssetPattern(assetOrigin) : null;

  // Cross-repo assertion: a localized site's /img URLs are external to its own
  // build/, so the local checks above cannot see a pruned English host tree.
  const crossRepo = skipCrossRepo
    ? skippedCrossRepo('--skip-cross-repo', {assetOrigin})
    : (() => {
        if (!assetOrigin) {
          return skippedCrossRepo(
            'no ASSET_ORIGIN (this build does not reference a shared asset host)',
            {assetOrigin},
          );
        }
        const resolved = resolveAssetHostBuild(assetHostBuild);
        if (!resolved) {
          return skippedCrossRepo(
            'English asset host build not found; pass --asset-host-build=DIR or --skip-cross-repo',
            {assetOrigin},
          );
        }
        return checkCrossRepoRefs(root, assetOrigin, resolved.dir, resolved.source);
      })();


  // Same locale-derived alternation as the source scan above: no single-locale
  // literal, so every configured translation locale is checked in every repo.
  const localePrefixRe = new RegExp(
    `/(?:${LOCALE_ALT})/(?:img|assets/(?:images|files))/`,
    'g',
  );

  const files = [];
  walk(root, (file) => {
    if (TEXT_EXT.has(path.extname(file).toLowerCase())) files.push(file);
  });

  const localeHits = [];
  const doubleHashHits = [];
  const refs = new Map(); // url path -> first source file
  const externalRefs = new Map(); // absolute URL -> first source file
  let localeHitCount = 0;
  let doubleHashCount = 0;
  let refCount = 0;
  let externalRefCount = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);

    // External (shared-origin) references: count them, then remove them from
    // the text the local checks see, so the `/img/…` inside an absolute URL is
    // not mistaken for a local path.
    let content = source;
    if (externalRe) {
      for (const match of source.matchAll(externalRe)) {
        externalRefCount += 1;
        if (!externalRefs.has(match[0])) externalRefs.set(match[0], rel);
      }
      content = source.replace(externalRe, '');
    }

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

  const failed =
    localeHitCount > 0 ||
    sourceDoubleHash.length > 0 ||
    staticBad.length > 0 ||
    missing.length > 0 ||
    sources.missing.length > 0 ||
    (crossRepo.enabled && crossRepo.missing > 0);

  // JSON contract: every counter plus `crossRepo` (enabled/skipped/skipReason,
  // assetOrigin, assetHostBuild, hostBuildSource, htmlFilesScanned, refs,
  // uniqueRefs, found, missing, missingDetails) and top-level `ok`.
  const report = {
    scannedHtmlXmlFiles: files.length,
    refCount,
    uniqueRefs: refs.size,
    externalRefCount,
    externalUniqueRefs: externalRefs.size,
    localePrefixedRefs: localeHitCount + sources.localePrefixed.length,
    doubleHashPdfRefs: sourceDoubleHash.length,
    doubleHashPdfFiles: staticBad.length,
    missingAssetFiles: missing.length,
    knownMissingIgnored: knownMissing,
    missingSourcePdfFiles: sources.missing.length,
    crossRepo,
    ok: !failed,
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`asset-refs: scanned ${files.length} html/xml files, ${refCount} refs (${refs.size} unique)`);
    if (assetOrigin) {
      console.log(
        `asset-refs: shared asset origin = ${assetOrigin} ` +
          `(external refs = ${externalRefCount}, ${externalRefs.size} unique; local existence checked against the asset host build)`,
      );
    }
    console.log(
      `asset-refs: scanned ${sources.mdFiles} source .md files, ${sources.refs} pdf links` +
        (sources.canCheckLocalFiles ? '' : ' (static/ absent: source file existence not checked)'),
    );
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
    if (crossRepo.enabled) {
      console.log(
        `asset-refs: cross-repo ${assetOrigin}/img: ${crossRepo.refs} refs ` +
          `(${crossRepo.uniqueRefs} unique), ${crossRepo.found} found, ${crossRepo.missing} missing ` +
          `<- ${crossRepo.assetHostBuild} (${crossRepo.hostBuildSource})`,
      );
      for (const item of crossRepo.missingDetails.slice(0, 10)) {
        console.log(`  CROSS-REPO-MISSING ${item.name} <- ${item.source}`);
      }
      if (crossRepo.missing > crossRepo.missingDetails.length) {
        console.log(`  ... and ${crossRepo.missing - crossRepo.missingDetails.length} more missing name(s)`);
      }
    } else {
      console.log(`asset-refs: cross-repo check skipped: ${crossRepo.skipReason}`);
    }
  }

  if (failed) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`asset-refs: ${error.message}`);
  process.exit(1);
}
