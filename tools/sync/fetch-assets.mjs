#!/usr/bin/env node
/**
 * Download the images a page references from the official site.
 *
 * The official Markdown references images relatively (`./img/index-01.webp`),
 * but the site serves them as content-hashed webpack assets
 * (`/assets/images/index-01-<hash>.webp`). For each page that needs an image the
 * tool fetches the rendered page once, maps the hashed assets back to the names
 * the Markdown uses, and stores them next to the page.
 *
 * The local legacy backup is only a bootstrap and is never used here.
 *
 * Some images are no longer served at any URL at all: the official site inlines
 * them below Webpack's size limit, so the rendered page carries
 * `src="data:image/webp;base64,…"` while the `.md` export still points at
 * `./img/packages1.png`. The bytes are on the rendered page, only the file is
 * gone (7.26's `getting-started/installation-and-upgrade/packages.md` is the
 * reference case). Those references are recovered:
 *
 *   - the Markdown image references are aligned with the article's `<img>`
 *     elements, by alt text when it identifies one unambiguously and otherwise
 *     by position (only when both lists have the same length);
 *   - a matching `data:` URI is decoded, its MIME (webp/png/jpeg/gif/svg) and
 *     its signature are checked, and the bytes are written under the **name the
 *     Markdown uses** (`img/packages1.png`), so the reference resolves. A
 *     mislabelled payload (e.g. JPEG bytes declared `image/png`, as on 7.26's
 *     `queues` page) is sniffed and accepted with a `MIME-MISMATCH` warning; the
 *     extension is never derived from the sniffed MIME, because rewriting the
 *     name would leave the reference broken;
 *   - `recovered N image(s) from rendered data URIs` lists what was written.
 *     A reference that neither the asset index nor a data URI explains still
 *     fails loudly; nothing is skipped silently.
 *
 * A thumbnail link (`[![](img/a.png)](img/a.png)`) is downloaded too: the href
 * names the same bytes, and `address-images` refuses to rewrite anything while
 * it points at a file that does not exist.
 *
 * A handful of pages instead carry a **root-absolute** asset URL copied from
 * the official site (`/assets/images/<name>.webp`, `/videos/<name>.mp4`). The
 * official site is served from the origin root, so `/assets/...` resolves; the
 * mirror lives under a `baseUrl` (`/mikrotik_manual_i18n/`), so the same URL
 * leaves the mirror. Those references are mirrored too:
 *
 *   - `/assets/images/<name>` is resolved through the page's own asset index to
 *     the content-hashed file the site actually serves, stored in the page's
 *     `img/` directory, and the reference is rewritten to a relative path
 *     (`./img/<hashed-name>`). A locale overlay shares the English page's
 *     `img/` directory, which is how every other image on those pages is
 *     referenced already.
 *   - `/videos/<name>` is downloaded once into `static/videos/` (shared by
 *     every page and locale) and the reference is left alone: the MDX build
 *     adds the `baseUrl` to root-absolute attributes
 *     (`tools/build/remark-prefix-root-refs.mjs`).
 *
 *   node tools/sync/fetch-assets.mjs                 # report only
 *   node tools/sync/fetch-assets.mjs --dry-run       # same, explicit
 *   node tools/sync/fetch-assets.mjs --apply         # download missing images
 *   node tools/sync/fetch-assets.mjs --apply --refresh
 *   node tools/sync/fetch-assets.mjs --apply --prune # also delete unreferenced images
 *   node tools/sync/fetch-assets.mjs --apply --versioned-only
 *                                                   # mirror only the root-absolute
 *                                                   # images in versioned_docs/ after
 *                                                   # materialize-final, then gate
 *
 * `--versioned-only` exists for one timing bug: on a cold start the archived
 * structure cache is restored *after* the ordinary assets pass, and the final
 * materialization writes its raw `/assets/images/<hash>.webp` references into
 * `versioned_docs/` after that pass has already finished. Those references used
 * to ship with no bytes (pages.yml then reported asset-refs missing=1 and
 * skipped the deploy). This mode walks only `versioned_docs/`, mirrors each
 * root-absolute hashed image into `static/assets/images/` (leaving the Markdown
 * reference untouched), and then asserts that every root-absolute image
 * reference in the product Markdown resolves there. A missing byte is a hard
 * failure — the gate is not relaxed, it merely runs inside sync instead of
 * being discovered later by the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {
  walkMarkdown,
  SECTIONS,
  sectionsFor,
  translatableLocales,
  REPO,
} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';
import {
  MIME_EXTENSION,
  alignRenderedImage,
  decodeInlineImage,
  imageFileName,
  imageLinksOf,
  imageReferencesOf,
  renderedImages,
} from './lib/rendered-images.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply') && !DRY_RUN;
const REFRESH = process.argv.includes('--refresh');
const PRUNE = process.argv.includes('--prune');
const VERSIONED_ONLY = process.argv.includes('--versioned-only');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

/**
 * Asset name -> public URL, from one rendered page.
 *
 * Both spellings are indexed: the plain name the Markdown export uses
 * (`controller-bridge-and-port-extender-02.webp`) and the full content-hashed
 * file name a root-absolute reference may carry
 * (`controller-bridge-and-port-extender-02-c9b2dd45….webp`). Indexing only the
 * plain name made such a reference miss the lookup and fail even though the
 * rendered page named the exact asset.
 */
function assetIndex(html, origin) {
  const map = new Map();
  for (const match of html.matchAll(/\/assets\/images\/([^"'\s>)]+)/g)) {
    const file = match[1];
    const plain = file.replace(/-[0-9a-f]{8,}\./i, '.');
    const url = new URL(match[0], origin).href;
    if (!map.has(plain)) map.set(plain, url);
    if (!map.has(file)) map.set(file, url);
  }
  return map;
}

const PAGE_FETCH_ATTEMPTS = 3;
// Exponential-ish backoff between attempts: 15s then 30s. Bounded so a page
// that is genuinely gone cannot stall the whole asset stage forever.
const PAGE_FETCH_BACKOFF_MS = [15000, 30000];
const PAGE_FETCH_TIMEOUT_MS = 30000;

/**
 * A content-addressed blob reference: `/img/<sha256(bytes)[:16]>.<ext>`.
 *
 * `address-images` rewrites every local image reference into this form and
 * stores the bytes once in `static/img/`. A page freshly fetched by
 * `fetch-hardware` can already carry the rewritten reference while its blob is
 * still absent from the shared store (the page was added after the last asset
 * pass, or the store was pruned). Such a reference is *not* a file under the
 * repository root: treating it like `/hardware/x/img/y.png` only marks a
 * nonexistent path as referenced and leaves the blob missing forever.
 */
const BLOB_REF = /^\/img\/([0-9a-f]{16})\.([a-z0-9]+)$/i;
const STATIC_IMG = path.join(REPO, 'static', 'img');

/**
 * A memoising byte loader for one rendered page.
 *
 * A blob-heavy page (the hardware quick guides carry 30+ `/img/<hash>` refs
 * each) used to re-download every rendered asset once *per blob*: `blobBytes`
 * rebuilt its candidate list for every reference and called `image()` again
 * for the same URL. That is both needlessly slow and fragile — a single
 * transient fetch failure on any one of those hundreds of requests left that
 * blob missing. Each candidate URL is now fetched at most once per page and
 * the bytes are shared by every blob that matches them. The sha256 proof is
 * unchanged: bytes are still only written when they prove their own name.
 */
function pageByteLoader() {
  const cache = new Map();
  return async (urlOrData) => {
    if (!cache.has(urlOrData)) {
      const pending = (async () =>
        urlOrData.startsWith('data:') ? decodeInlineImage(urlOrData).bytes : image(urlOrData))();
      cache.set(urlOrData, pending);
      // A failed request must not poison the cache: a later blob on the same
      // page gets a fresh attempt.
      pending.catch(() => cache.delete(urlOrData));
    }
    return cache.get(urlOrData);
  };
}

/**
 * Fetch the bytes of one content-addressed blob from the official rendered
 * page. The positional match is tried first (the common case); when it misses
 * — the page gained a logo, reordered its images, or inlined some of them —
 * every rendered asset and inline data URI is tried until the sha256 prefix
 * matches the name. Nothing is written unless the bytes prove their own name.
 */
async function blobBytes(hash, {index, ordered, inline, bytesFor}) {
  const seen = new Set();
  const candidates = [];
  const addUrl = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push(() => bytesFor(url));
  };
  const addData = (src) => {
    if (!src?.startsWith('data:') || seen.has(src)) return;
    seen.add(src);
    candidates.push(() => bytesFor(src));
  };

  if (inline) {
    if (inline.src?.startsWith('data:')) addData(inline.src);
    else addUrl(inline.url);
  }
  for (const rendered of ordered) {
    if (rendered.src?.startsWith('data:')) addData(rendered.src);
    else addUrl(rendered.url);
  }
  for (const assetUrl of index.values()) addUrl(assetUrl);

  const attempts = [];
  for (const load of candidates) {
    let bytes;
    try {
      bytes = await load();
    } catch (error) {
      attempts.push(error.message);
      continue;
    }
    if (crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16) === hash) {
      return bytes;
    }
  }
  throw new Error(
    `no rendered image matches blob ${hash}${attempts.length ? ` (${attempts.slice(0, 3).join('; ')})` : ''}`,
  );
}

/**
 * Fetch a rendered page with a bounded retry. The official site occasionally
 * drops a connection mid-run (`fetch failed` with no HTTP status); a single
 * failed page used to leave every image on it missing. Retries are reported so
 * a transient failure is visible instead of being silently absorbed.
 */
async function text(url) {
  let lastError;
  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < PAGE_FETCH_ATTEMPTS) {
        const wait = PAGE_FETCH_BACKOFF_MS[attempt - 1] ?? 30000;
        console.log(`PAGE-RETRY ${url} attempt ${attempt}/${PAGE_FETCH_ATTEMPTS} failed (${error.message}); retrying in ${wait / 1000}s`);
        await delay(wait);
      }
    }
  }
  throw lastError;
}

/** A dropped connection (or a 5xx) may recover; a 404/HTML response will not. */
function transientFetchError(error) {
  const message = String(error?.message || '');
  return /fetch failed|aborted|timeout|timed out|ECONNRESET|ECONNREFUSED|EPIPE|HTTP 5\d\d|HTTP 429/i.test(message);
}

async function image(url) {
  let lastError;
  for (let attempt = 1; attempt <= PAGE_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get('content-type') || '';
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!type.startsWith('image/')) {
        throw new Error(`not an image (${type || 'unknown'})`);
      }
      if (!bytes.length) throw new Error('empty image');
      return bytes;
    } catch (error) {
      lastError = error;
      if (!transientFetchError(error) || attempt === PAGE_FETCH_ATTEMPTS) break;
      const wait = PAGE_FETCH_BACKOFF_MS[attempt - 1] ?? 30000;
      await delay(wait);
    }
  }
  throw lastError;
}

async function video(url) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!type.startsWith('video/')) {
    throw new Error(`not a video (${type || 'unknown'})`);
  }
  return bytes;
}

/**
 * Root-absolute asset URLs in a page body, in order and without duplicates.
 *
 * Only the two prefixes that actually occur in the corpus are recognised, and
 * the match must start the value: prose that mentions `static/videos/`
 * (`/videos/` preceded by a word character) is not a reference. A
 * `#fragment` / `?query` is kept as a suffix so the rewritten reference can
 * carry it over unchanged.
 */
const ROOT_ASSET = /(?<![\w./-])\/(?:assets\/images|videos)\/[^\s"')>]+/g;

function rootAssetsOf(body) {
  const seen = new Set();
  const out = [];
  for (const match of body.matchAll(ROOT_ASSET)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);
    const bare = raw.split('#')[0].split('?')[0];
    out.push({
      raw,
      bare,
      suffix: raw.slice(bare.length),
      name: path.basename(bare),
      kind: bare.startsWith('/videos/') ? 'video' : 'image',
    });
  }
  return out;
}

/** `./img/<name>` for a sibling, `../../hardware/.../img/<name>` across the tree. */
function relativeReference(fromFile, target) {
  const rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

// ---------------------------------------------------------------------------
// `--versioned-only`: mirror root-absolute archived images after the final
// materialization, then gate on every product Markdown reference.
//
// The ordinary pass above rewrites `/assets/images/<name>` into a page-relative
// `./img/<hash>` and writes the bytes next to the page. It cannot do that for a
// reference that only appears later, when `restore-table-structure-<archive>`
// puts the rendered `<img>` back and `materialize-final` writes it into
// `versioned_docs/`. Those references have to stay root-absolute (they are the
// ones pages.yml checks), so this pass mirrors the exact hashed file into the
// shared `static/assets/images/` tree and leaves the Markdown untouched.
// ---------------------------------------------------------------------------

const VERSIONED_IMAGES_DIR = path.join(REPO, 'static/assets/images');
const OFFICIAL_ORIGIN = 'https://manual.mikrotik.com';
// Only plain file names are accepted: the reference is a basename of a URL,
// never a path that could escape the mirror directory.
const VERSIONED_IMAGE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;
const relToRepo = (file) => path.relative(REPO, file).split(path.sep).join('/');

function versionedImageRefs(body) {
  return rootAssetsOf(body).filter((ref) => ref.kind === 'image');
}

/** The official origin is the page's own `source`; fall back to the site root. */
function originFor(contents) {
  const source = readField(splitFrontMatter(contents).frontMatter, 'source');
  if (!source) return OFFICIAL_ORIGIN;
  try {
    return new URL(source).origin;
  } catch {
    return OFFICIAL_ORIGIN;
  }
}

/** Every shipped Markdown product tree, not just the archived release. */
function productMarkdown() {
  return [
    ...walkMarkdown(path.join(REPO, 'versioned_docs')),
    ...walkMarkdown(path.join(REPO, 'docs')),
  ];
}

async function mirrorVersionedImages() {
  const log = [];
  const summary = {pages: 0, refs: 0, downloaded: 0, reused: 0, failed: 0, missingAfterGate: 0};

  for (const file of walkMarkdown(path.join(REPO, 'versioned_docs'))) {
    const contents = fs.readFileSync(file, 'utf8');
    const {body} = splitFrontMatter(contents);
    const refs = versionedImageRefs(body);
    if (!refs.length) continue;
    summary.pages++;
    const origin = originFor(contents);
    for (const ref of refs) {
      summary.refs++;
      if (!VERSIONED_IMAGE_FILE.test(ref.name)) {
        summary.failed++;
        log.push(`FAILED ${relToRepo(file)} ${ref.raw} (unsafe asset name)`);
        continue;
      }
      const target = path.join(VERSIONED_IMAGES_DIR, ref.name);
      if (fs.existsSync(target)) {
        summary.reused++;
        continue;
      }
      if (!APPLY) {
        log.push(`MISSING ${relToRepo(target)} <- ${relToRepo(file)} ${ref.raw}`);
        continue;
      }
      try {
        // The hashed file itself is the URL the official site serves; no page
        // fetch / asset-index round trip is needed for this exact-name form.
        const bytes = await image(new URL(ref.bare, origin).href);
        fs.mkdirSync(VERSIONED_IMAGES_DIR, {recursive: true});
        fs.writeFileSync(target, bytes);
        summary.downloaded++;
        log.push(`DOWNLOADED ${relToRepo(target)} ${bytes.length} bytes`);
      } catch (error) {
        summary.failed++;
        log.push(`FAILED ${relToRepo(target)} <- ${ref.raw}: ${error.message}`);
      }
    }
  }

  // The gate is deliberately independent of the download loop: a byte that was
  // already present or a reference introduced by a later stage still has to
  // resolve. Missing is a failure here, exactly as it is in pages.yml later —
  // the point is to fail inside sync, before deploy is allowed to skip.
  for (const file of productMarkdown()) {
    const {body} = splitFrontMatter(fs.readFileSync(file, 'utf8'));
    for (const ref of versionedImageRefs(body)) {
      const target = path.join(VERSIONED_IMAGES_DIR, ref.name);
      if (fs.existsSync(target)) continue;
      summary.missingAfterGate++;
      log.push(`MISSING-AFTER ${relToRepo(file)} ${ref.raw} -> ${relToRepo(target)}`);
    }
  }
  return {summary, log};
}

if (VERSIONED_ONLY) {
  // Use unbuffered writes: this branch exits before the ordinary report at the
  // end of the file, and a piped console.log could be lost on process.exit().
  const {summary, log} = await mirrorVersionedImages();
  for (const line of log) fs.writeSync(1, `${line}\n`);
  fs.writeSync(1, `${JSON.stringify({...summary, apply: APPLY, dryRun: DRY_RUN || !APPLY})}\n`);
  if (summary.failed || summary.missingAfterGate) {
    fs.writeSync(
      2,
      `ERROR: versioned image mirror failed: ${summary.failed} download/name failure(s), ` +
        `${summary.missingAfterGate} unresolved /assets/images reference(s) in product Markdown.\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}

const stats = {
  pages: 0,
  refs: 0,
  links: 0,
  missing: 0,
  downloaded: 0,
  refreshed: 0,
  recovered: 0,
  mimeMismatch: 0,
  failed: 0,
  external: 0,
};
/** Images written from a rendered `data:` URI: `{file, mime, bytes}`. */
const recovered = [];
/**
 * Representative failures for the end-of-run ERROR summary. A failed reference
 * used to be counted but never surfaced outside the JSON summary, so the assets
 * stage passed CI and the gap was only found after the build. Keep a bounded
 * set of URL/path samples so the failure is actionable in the CI log.
 */
const failureSamples = [];
function noteFailure(sample) {
  if (failureSamples.length < 8) failureSamples.push(sample);
}
const referenced = new Set();
// Pruning is destructive, so it also keeps a file whose *name* appears in any
// page: an image can be referenced site-absolutely (`/hardware/x/img/y.png`)
// or by a canonical name whose local copy is content-hashed.
const referencedNames = new Set();
const IMAGE_FILE = /\.(?:png|jpe?g|webp|gif|svg|avif|ico)$/i;

for (const section of SECTIONS) {
  const base = path.join(REPO, section.source);
  for (const file of walkMarkdown(base)) {
    const text_ = fs.readFileSync(file, 'utf8');
    const {frontMatter, body} = splitFrontMatter(text_);
    const source = readField(frontMatter, 'source');
    const images = imageReferencesOf(body);
    if (!images.length) continue;

    // An image reference keeps its position in the page's image list: that is
    // what a rendered `<img>` with no alt text is aligned against. A thumbnail
    // link (`[![](img/a.png)](img/a.png)`) names the same bytes but has no
    // position of its own; it is only downloaded, never used for alignment.
    const refs = images.map((image, position) => ({...image, imagePosition: position}));
    const seen = new Set(images.map((image) => image.url.split('#')[0].split('?')[0]));
    for (const link of imageLinksOf(body)) {
      const bare = link.url.split('#')[0].split('?')[0];
      if (seen.has(bare)) continue;
      seen.add(bare);
      refs.push({...link, imagePosition: -1});
      stats.links++;
    }
    stats.pages++;

    const targets = [];
    for (const ref of refs) {
      const {url} = ref;
      stats.refs++;
      const bare = url.split('#')[0].split('?')[0];
      if (bare) referencedNames.add(path.basename(bare));
      if (/^https?:\/\//i.test(url)) {
        stats.external++;
        continue;
      }
      const blob = BLOB_REF.exec(bare);
      if (blob) {
        // The blob store is the target, not a page-local img/ directory: keep
        // the path referenced so pruning cannot delete a freshly fetched blob,
        // and (re)download it when the store does not have it yet.
        const target = path.join(STATIC_IMG, `${blob[1]}.${blob[2].toLowerCase()}`);
        referenced.add(target);
        if (!fs.existsSync(target) || REFRESH) targets.push({...ref, target, blob: blob[1]});
        continue;
      }
      if (url.startsWith('/')) {
        // A site-absolute path still names a local file (`/hardware/...`).
        const local = path.resolve(REPO, bare.replace(/^\/+/, ''));
        if (local.startsWith(path.resolve(REPO) + path.sep)) referenced.add(local);
        stats.external++;
        continue;
      }
      // `img/x.jpg#gh-light-mode-only` names a file plus a display hint.
      const target = path.resolve(path.dirname(file), url.split('#')[0]);
      if (!target.startsWith(path.resolve(base) + path.sep)) {
        stats.failed++;
        noteFailure(`OUTSIDE ${path.relative(REPO, file)} ${url}`);
        console.log('OUTSIDE', path.relative(REPO, file), url);
        continue;
      }
      referenced.add(target);
      if (!fs.existsSync(target) || REFRESH) targets.push({...ref, target});
    }
    if (!targets.length) continue;
    stats.missing += targets.filter(({target}) => !fs.existsSync(target)).length;

    if (!APPLY) {
      for (const {target} of targets) {
        if (LIMIT && stats.missing > LIMIT) break;
        console.log(fs.existsSync(target) ? 'REFRESH' : 'MISSING', path.relative(REPO, target));
      }
      continue;
    }
    if (!source) {
      stats.failed += targets.length;
      for (const {url, target} of targets) {
        noteFailure(`NO-SOURCE-URL ${path.relative(REPO, target)} <- ${url} (${path.relative(REPO, file)})`);
      }
      console.log('NO-SOURCE-URL', path.relative(REPO, file));
      continue;
    }

    let index = new Map();
    let ordered = [];
    let origin = source;
    const bytesFor = pageByteLoader();
    try {
      const pageUrl = source.endsWith('/') ? source : `${source}/`;
      const html = await text(pageUrl);
      origin = new URL(pageUrl).origin;
      index = assetIndex(html, origin);
      ordered = renderedImages(html, origin);
    } catch (error) {
      stats.failed++;
      noteFailure(`PAGE-FAILED ${source} — ${error.message}`);
      console.error(`PAGE-FAILED after ${PAGE_FETCH_ATTEMPTS} attempt(s) ${source} — ${error.message}`);
    }

    for (const {url, target, imagePosition, alt, blob} of targets) {
      const name = imageFileName(url);
      const asset = index.get(name);
      const inline = imagePosition >= 0
        ? alignRenderedImage(ordered, {alt, index: imagePosition, count: images.length})
        : null;
      const existed = fs.existsSync(target);
      const attempts = [];
      try {
        let bytes = null;
        let via = null;
        let mime = null;
        let declaredMime = null;
        let mimeMismatch = false;

        // Order: the content-hashed asset the page's own index names, then the
        // rendered element (a `data:` URI, or the URL it carries), then the
        // reference resolved against the page URL — which is exactly the path
        // the official site no longer serves, so it is tried last.
        // A blob reference carries no official file name; recover it from the
        // rendered page, proving the bytes by their sha256 prefix.
        if (blob) {
          bytes = await blobBytes(blob, {index, ordered, inline, bytesFor});
          via = 'blob';
        }
        if (asset) {
          try {
            bytes = await image(asset);
            via = 'asset';
          } catch (error) {
            attempts.push(`asset ${error.message}`);
          }
        }
        if (!bytes && inline?.src?.startsWith('data:')) {
          try {
            const decoded = decodeInlineImage(inline.src);
            bytes = decoded.bytes;
            mime = decoded.mime;
            declaredMime = decoded.declaredMime;
            mimeMismatch = decoded.mimeMismatch;
            via = 'data';
          } catch (error) {
            attempts.push(`data URI ${error.message}`);
          }
        }
        if (!bytes && inline?.url) {
          try {
            bytes = await image(inline.url);
            via = 'rendered';
          } catch (error) {
            attempts.push(`rendered ${error.message}`);
          }
        }
        if (!bytes) {
          try {
            bytes = await image(new URL(url, `${source}/`).href);
            via = 'direct';
          } catch (error) {
            attempts.push(`source ${error.message}`);
          }
        }
        if (!bytes) throw new Error(attempts.join('; ') || 'no source could be resolved');
        if (!bytes.length) throw new Error('empty image');

        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, bytes);
        if (existed) stats.refreshed++;
        else stats.downloaded++;

        const relative = path.relative(REPO, target);
        if (via === 'data') {
          stats.recovered++;
          recovered.push({
            file: relative,
            mime,
            bytes: bytes.length,
            ...(mimeMismatch ? {declaredMime, mimeMismatch: true} : {}),
          });
          if (mimeMismatch) stats.mimeMismatch++;
          // The Markdown reference names the file. `fs.writeFileSync(target, …)`
          // above already used the md path: never derive the written extension
          // from the sniffed MIME, or the reference that needed rescuing would
          // stay broken and address-images would still report it missing.
          const expected = path.extname(name).toLowerCase();
          if (mimeMismatch || (expected && expected !== MIME_EXTENSION[mime])) {
            console.log('MIME-MISMATCH', relative, `${declaredMime || mime} bytes are ${mime}, kept as ${name}`);
          }
          console.log('RECOVERED', relative, `${bytes.length} bytes`, mime, 'from rendered data URI');
        } else {
          console.log(
            via === 'blob' ? 'DOWNLOADED-BLOB' : via === 'asset' ? 'DOWNLOADED' : 'DOWNLOADED-DIRECT',
            relative,
          );
        }
      } catch (error) {
        stats.failed++;
        noteFailure(`FAILED ${path.relative(REPO, target)} <- ${url} — ${error.message}`);
        console.log('FAILED', path.relative(REPO, target), error.message);
      }
    }
  }
}

if (recovered.length) {
  console.log(`recovered ${recovered.length} image(s) from rendered data URIs`);
  for (const entry of recovered) {
    const note = entry.mimeMismatch ? `, MIME-MISMATCH from ${entry.declaredMime}` : '';
    console.log(`  ${entry.file} (${entry.bytes} bytes, ${entry.mime}${note})`);
  }
  console.log(`MIME-MISMATCH recovered successfully: ${stats.mimeMismatch}`);
}

// ---------------------------------------------------------------------------
// Root-absolute references (`/assets/images/...`, `/videos/...`).
//
// Separate pass: it must run for a page whose *only* asset references are
// root-absolute (the video pages), and for the locale overlays, which the main
// loop above does not walk (it only walks the English section sources).
// ---------------------------------------------------------------------------

const staticVideos = path.join(REPO, 'static/videos');
const rootStats = {
  pages: 0,
  refs: 0,
  images: 0,
  videos: 0,
  downloaded: 0,
  rewritten: 0,
  reused: 0,
  failed: 0,
};

/** English section roots plus every locale overlay that mirrors one. */
const rootPages = SECTIONS.map((section) => ({
  dir: path.join(REPO, section.source),
  englishDir: path.join(REPO, section.source),
}));
for (const locale of translatableLocales()) {
  for (const section of sectionsFor(locale)) {
    const dir = path.join(REPO, section.overlay);
    if (!fs.existsSync(dir)) continue;
    rootPages.push({dir, englishDir: path.join(REPO, section.source)});
  }
}

for (const {dir, englishDir} of rootPages) {
  for (const file of walkMarkdown(dir)) {
    const contents = fs.readFileSync(file, 'utf8');
    const {frontMatter, body} = splitFrontMatter(contents);
    const refs = rootAssetsOf(body);
    if (!refs.length) continue;
    rootStats.pages++;

    const source = readField(frontMatter, 'source');
    // A locale overlay shares the English page's `img/` directory: that is how
    // every other image on the page is referenced, and it keeps one copy of
    // the bytes instead of a second tree under `i18n/`.
    const englishFile = path.join(englishDir, path.relative(dir, file));
    const imageDir = path.join(
      fs.existsSync(englishFile) ? path.dirname(englishFile) : path.dirname(file),
      'img',
    );

    let assetMap = null;
    let assetMapError = null;
    if (refs.some((ref) => ref.kind === 'image')) {
      if (!source) {
        assetMapError = 'no source URL in front matter';
      } else {
        try {
          const pageUrl = source.endsWith('/') ? source : `${source}/`;
          assetMap = assetIndex(await text(pageUrl), new URL(pageUrl).origin);
        } catch (error) {
          assetMapError = `page fetch failed: ${error.message}`;
          console.error(`PAGE-FAILED after ${PAGE_FETCH_ATTEMPTS} attempt(s) ${pageUrl} — ${error.message}`);
        }
      }
    }

    let nextBody = body;
    for (const ref of refs) {
      rootStats.refs++;
      const target0 = path.relative(REPO, file);

      if (ref.kind === 'video') {
        rootStats.videos++;
        const target = path.join(staticVideos, ref.name);
        if (fs.existsSync(target)) {
          rootStats.reused++;
          console.log('PRESENT', path.relative(REPO, target));
          continue;
        }
        if (!APPLY) {
          console.log('MISSING', path.relative(REPO, target), `<- ${target0}`);
          continue;
        }
        try {
          const origin = source || 'https://manual.mikrotik.com';
          const bytes = await video(new URL(ref.bare, origin).href);
          fs.mkdirSync(staticVideos, {recursive: true});
          fs.writeFileSync(target, bytes);
          rootStats.downloaded++;
          console.log('DOWNLOADED', path.relative(REPO, target), `${bytes.length} bytes`);
        } catch (error) {
          rootStats.failed++;
          console.log('FAILED', path.relative(REPO, target), error.message);
        }
        continue;
      }

      rootStats.images++;
      if (assetMapError) {
        rootStats.failed++;
        console.log('FAILED', target0, ref.raw, assetMapError);
        continue;
      }
      const asset = assetMap.get(ref.name);
      if (!asset) {
        rootStats.failed++;
        console.log('FAILED', target0, ref.raw, 'not in the rendered page asset index');
        continue;
      }
      const realName = path.basename(new URL(asset).pathname);
      const target = path.join(imageDir, realName);
      // The reference sets above were built from the *pre-rewrite* Markdown:
      // they know `/assets/images/x.png` but not `img/x-<hash>.png`. Register
      // the file this pass downloads (or reuses) and points the page at, or the
      // prune pass at the end of this very run deletes it as an orphan. Keep
      // both forms: the absolute target for this page, and the hashed file name
      // for a copy shared with a locale overlay or another page.
      referenced.add(target);
      referencedNames.add(realName);
      const replacement = `${relativeReference(file, target)}${ref.suffix}`;
      if (!fs.existsSync(target)) {
        if (!APPLY) {
          console.log('MISSING', path.relative(REPO, target), `<- ${target0}`);
        } else {
          try {
            const bytes = await image(asset);
            fs.mkdirSync(path.dirname(target), {recursive: true});
            fs.writeFileSync(target, bytes);
            rootStats.downloaded++;
            console.log('DOWNLOADED', path.relative(REPO, target), `${bytes.length} bytes`);
          } catch (error) {
            rootStats.failed++;
            console.log('FAILED', path.relative(REPO, target), error.message);
            continue;
          }
        }
      } else {
        rootStats.reused++;
      }
      if (ref.raw === replacement) continue;
      nextBody = nextBody.split(ref.raw).join(replacement);
      if (APPLY) {
        rootStats.rewritten++;
        console.log('REWROTE', target0, `${ref.raw} -> ${replacement}`);
      } else {
        console.log('REWRITE', target0, `${ref.raw} -> ${replacement}`);
      }
    }

    if (APPLY && nextBody !== body) {
      fs.writeFileSync(file, `${contents.slice(0, contents.length - body.length)}${nextBody}`);
    }
  }
}

let pruned = 0;
if (APPLY && PRUNE) {
  for (const section of SECTIONS) {
    const base = path.join(REPO, section.source);
    // versions.json still lists archives that a cold start has not yet
    // materialised: SECTIONS describes them, but there is no tree to prune.
    // Skip an absent tree instead of letting readdirSync abort the whole stage.
    if (!fs.existsSync(base)) {
      console.warn(`WARNING: prune: ${path.relative(REPO, base)} not materialized; skipping ${section.name}`);
      continue;
    }
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (!entry.isDirectory()) continue;
        if (entry.name === 'img') {
          for (const imageName of fs.readdirSync(full)) {
            const imagePath = path.join(full, imageName);
            // Never touch non-images: `_category_.json` and friends are
            // Docusaurus metadata, not assets.
            if (!IMAGE_FILE.test(imageName)) continue;
            if (referenced.has(imagePath) || referencedNames.has(imageName)) continue;
            fs.rmSync(imagePath);
            pruned++;
            console.log('PRUNED', path.relative(REPO, imagePath));
          }
        } else {
          stack.push(full);
        }
      }
    }
  }
}

console.log(
  JSON.stringify({
    ...stats,
    recoveredImages: recovered,
    pruned,
    root: rootStats,
    apply: APPLY,
    dryRun: DRY_RUN || !APPLY,
    refresh: REFRESH,
    prune: PRUNE,
  }),
);

// A counted-but-ignored failure used to let the assets stage pass CI with a
// missing blob; verify:orphan-assets / verify:addressing-ready then found it
// only after the build, when repairing it was already too late. Retries have
// been exhausted by this point, so a non-zero exit here is the correct signal.
if (stats.failed > 0) {
  console.error(
    `ERROR: fetch-assets failed on ${stats.failed} image reference(s); ` +
      'the assets stage cannot pass with missing images.\n' +
      `Examples (${failureSamples.length} of ${stats.failed}):\n` +
      failureSamples.map((sample) => `  ${sample}`).join('\n'),
  );
  process.exitCode = 1;
}
