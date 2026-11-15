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
 *     Markdown uses** (`img/packages1.png`), so the reference resolves;
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
 */

import fs from 'node:fs';
import path from 'node:path';
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
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

/** hashed asset name -> public URL, from one rendered page */
function assetIndex(html, origin) {
  const map = new Map();
  for (const match of html.matchAll(/\/assets\/images\/([^"'\s>)]+)/g)) {
    const file = match[1];
    const plain = file.replace(/-[0-9a-f]{8,}\./i, '.');
    if (!map.has(plain)) map.set(plain, new URL(match[0], origin).href);
  }
  return map;
}

async function text(url) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function image(url) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!type.startsWith('image/')) {
    throw new Error(`not an image (${type || 'unknown'})`);
  }
  if (!bytes.length) throw new Error('empty image');
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

const stats = {
  pages: 0,
  refs: 0,
  links: 0,
  missing: 0,
  downloaded: 0,
  refreshed: 0,
  recovered: 0,
  failed: 0,
  external: 0,
};
/** Images written from a rendered `data:` URI: `{file, mime, bytes}`. */
const recovered = [];
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
      ordered = renderedImages(html, origin);
    } catch (error) {
      console.log('PAGE-FAILED', source, error.message);
    }

    for (const {url, target, imagePosition, alt} of targets) {
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

        // Order: the content-hashed asset the page's own index names, then the
        // rendered element (a `data:` URI, or the URL it carries), then the
        // reference resolved against the page URL — which is exactly the path
        // the official site no longer serves, so it is tried last.
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
          recovered.push({file: relative, mime, bytes: bytes.length});
          const expected = path.extname(name).toLowerCase();
          if (expected && expected !== MIME_EXTENSION[mime]) {
            // The Markdown name wins: rewriting it would leave the reference
            // that needed rescuing broken. Flag the disagreement instead.
            console.log('MIME-MISMATCH', relative, `${mime} kept as ${name}`);
          }
          console.log('RECOVERED', relative, `${bytes.length} bytes`, mime, 'from rendered data URI');
        } else {
          console.log(via === 'asset' ? 'DOWNLOADED' : 'DOWNLOADED-DIRECT', relative);
        }
      } catch (error) {
        stats.failed++;
        console.log('FAILED', path.relative(REPO, target), error.message);
      }
    }
  }
}

if (recovered.length) {
  console.log(`recovered ${recovered.length} image(s) from rendered data URIs`);
  for (const entry of recovered) console.log(`  ${entry.file} (${entry.bytes} bytes, ${entry.mime})`);
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
