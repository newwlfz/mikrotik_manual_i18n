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
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import * as cheerio from 'cheerio';
import {
  walkMarkdown,
  SECTIONS,
  sectionsFor,
  translatableLocales,
  REPO,
} from '../translate/lib/paths.mjs';
import {splitFrontMatter, readField} from '../translate/lib/frontmatter.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply') && !DRY_RUN;
const REFRESH = process.argv.includes('--refresh');
const PRUNE = process.argv.includes('--prune');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

const IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)|<img[^>]*\ssrc=["']([^"']+)["']/g;

function imagesOf(body) {
  const pattern = new RegExp(IMAGE.source, 'g');
  const out = [];
  let match;
  while ((match = pattern.exec(body)) !== null) out.push(match[1] || match[2]);
  return out;
}

/**
 * Ordered `<img>` list of the rendered article, so a page whose images the
 * official site inlines as `data:image/...;base64` still yields bytes.
 */
function pageImages(html, origin) {
  const $ = cheerio.load(html);
  const marked = $('.theme-doc-markdown').first();
  const root = marked.length ? marked : $('article').first();
  const out = [];
  root.find('img').each((_, element) => {
    const src = $(element).attr('src');
    if (!src) return;
    out.push({src, url: src.startsWith('data:') ? null : new URL(src, origin).href});
  });
  return out;
}

function decodeDataUri(uri) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri);
  if (!match) throw new Error('unsupported data URI');
  return match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'binary');
}

/**
 * Asset name -> public URL, from one rendered page.
 *
 * Both spellings are indexed: the plain name the Markdown export uses and the
 * full content-hashed file name a root-absolute reference may carry. Indexing
 * only the plain name made such a reference miss the lookup even though the
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
// Exponential-ish backoff between attempts: 15s then 30s, bounded so a page
// that is genuinely gone cannot stall the whole asset stage forever.
const PAGE_FETCH_BACKOFF_MS = [15000, 30000];
const PAGE_FETCH_TIMEOUT_MS = 30000;

/**
 * A content-addressed blob reference (`/img/<sha256(bytes)[:16]>.<ext>`) as
 * written by address-images. Pages can arrive with the rewritten reference but
 * without the shared blob: fetch the bytes from the rendered page and prove
 * them by their sha256 prefix before writing into `static/img/`.
 */
const BLOB_REF = /^\/img\/([0-9a-f]{16})\.([a-z0-9]+)$/i;
const STATIC_IMG = path.join(REPO, 'static', 'img');

async function blobBytes(hash, {index, ordered, inline}) {
  const seen = new Set();
  const candidates = [];
  const addUrl = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push(() => image(url));
  };
  const addData = (src) => {
    if (!src?.startsWith('data:') || seen.has(src)) return;
    seen.add(src);
    candidates.push(() => decodeDataUri(src));
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
  for (const load of candidates) {
    let bytes;
    try {
      bytes = await load();
    } catch {
      continue;
    }
    if (crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16) === hash) return bytes;
  }
  throw new Error(`no rendered image matches blob ${hash}`);
}

/** Fetch a rendered page with a bounded retry (15s/30s backoff, 30s timeout). */
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

async function image(url) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!type.startsWith('image/')) {
    throw new Error(`not an image (${type || 'unknown'})`);
  }
  return bytes;
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

const stats = {pages: 0, refs: 0, missing: 0, downloaded: 0, refreshed: 0, failed: 0, external: 0};
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
    const images = imagesOf(body);
    if (!images.length) continue;
    stats.pages++;

    const targets = [];
    for (const url of images) {
      stats.refs++;
      const bare = url.split('#')[0].split('?')[0];
      if (bare) referencedNames.add(path.basename(bare));
      if (/^https?:\/\//i.test(url)) {
        stats.external++;
        continue;
      }
      const blob = BLOB_REF.exec(bare);
      if (blob) {
        const target = path.join(STATIC_IMG, `${blob[1]}.${blob[2].toLowerCase()}`);
        referenced.add(target);
        if (!fs.existsSync(target) || REFRESH) targets.push({url, target, position: images.indexOf(url), blob: blob[1]});
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
      if (!fs.existsSync(target) || REFRESH) targets.push({url, target, position: images.indexOf(url)});
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
    try {
      const pageUrl = source.endsWith('/') ? source : `${source}/`;
      const html = await text(pageUrl);
      origin = new URL(pageUrl).origin;
      index = assetIndex(html, origin);
      ordered = pageImages(html, origin);
    } catch (error) {
      stats.failed++;
      noteFailure(`PAGE-FAILED ${source} — ${error.message}`);
      console.error(`PAGE-FAILED after ${PAGE_FETCH_ATTEMPTS} attempt(s) ${source} — ${error.message}`);
    }

    for (const {url, target, position, blob} of targets) {
      const name = path.basename(url);
      const asset = index.get(name);
      const inline = ordered.length === images.length ? ordered[position] : null;
      const existed = fs.existsSync(target);
      try {
        const bytes = blob
          ? await blobBytes(blob, {index, ordered, inline})
          : inline?.url === null && inline.src.startsWith('data:')
            ? decodeDataUri(inline.src)
            : asset
              ? await image(asset)
              : await image(inline?.url || new URL(url, `${source}/`).href);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, bytes);
        if (existed) stats.refreshed++;
        else stats.downloaded++;
        console.log(blob ? 'DOWNLOADED-BLOB' : asset ? 'DOWNLOADED' : 'DOWNLOADED-DIRECT', path.relative(REPO, target));
      } catch (error) {
        stats.failed++;
        noteFailure(`FAILED ${path.relative(REPO, target)} <- ${url} — ${error.message}`);
        console.log('FAILED', path.relative(REPO, target), error.message);
      }
    }
  }
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
