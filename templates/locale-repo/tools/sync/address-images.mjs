#!/usr/bin/env node
/**
 * Store every content image once, under its own content hash.
 *
 * The corpus grew page-local image folders (`docs/…/img/<official-name>.webp`):
 * every release, every locale and every page that repeats a picture carries its
 * own byte-identical copy. `versioned_docs` alone holds thirty copies of the
 * same WinBox screenshot because the official site names each file per page.
 *
 * The mirror keeps one copy of each blob instead:
 *
 *     static/img/<sha256(bytes)[:16]>.<ext>
 *
 * and every reference becomes the site-absolute `/img/<blob>`.
 *
 * Why the Webpack build does not duplicate it
 * -------------------------------------------
 * `@docusaurus/mdx-loader`'s `transformImage` resolves a *root-absolute* image
 * URL against `staticDirs` (`static/`), then `require()`s the file. The emitted
 * name is `assets/images/[name]-[contenthash].[ext]`, so two pages that require
 * the same blob emit the same file: naming the source after its content is what
 * makes a cross-version or cross-locale duplicate collapse into one output. A
 * relative `./img/x.webp` could never do that — the emitted name depends on the
 * basename, and the official site uses different basenames for equal bytes.
 *
 * `#gh-light-mode-only` / `#gh-dark-mode-only` are *display* hints the theme
 * reads off the URL, so the fragment is carried over verbatim; `transformImage`
 * keeps it on the emitted `src` as well.
 *
 * What is rewritten
 * -----------------
 *   - Markdown images `![alt](target)` (relative or already `/img/…`);
 *   - a Markdown *link* whose target is a local image file — the corpus uses
 *     `[![](img/a.png)](img/a.png)` for click-to-enlarge thumbnails, and the
 *     href would 404 once the page-local file is gone;
 *   - `src` / `srcset` / `poster` attributes of raw HTML and JSX tags
 *     (`<Img src="/img/…">` on the hardware pages, `<img>`, `<p><Img …></p>`).
 *
 * External references (`http:`, `protocol-relative`, `data:`), dynamic JSX
 * expressions (`src={…}`) and non-image targets are left alone. References that
 * cannot be resolved to a file are counted as `missing`; a single one aborts the
 * write, because rewriting half a tree is worse than not rewriting it.
 *
 * `--write` also deletes the page-local copies that nothing points at any more,
 * but only after the bytes are in `static/img`: the blob is copied first, so a
 * crash between the two leaves a duplicate, never a hole. Auxiliary trees that
 * are not part of the rewrite (`src/`, `corrections/`, `config/`, `data/`,
 * `guides/`, `upstream/`, root docs) are scanned read-only, and a content image
 * they still name is kept (`kept`) instead of deleted.
 *
 *   node tools/sync/address-images.mjs              # report only (default)
 *   node tools/sync/address-images.mjs --dry-run    # same, explicit
 *   node tools/sync/address-images.mjs --write      # copy, rewrite, prune
 *
 * The run is idempotent: a second `--write` copies nothing (`moved=0`), rewrites
 * nothing and deletes nothing (`deleted=0`), because every reference is already
 * `/img/<hash>` and every page-local copy is already gone.
 *
 * Exit codes: 0 = clean; 1 = unresolved references (nothing written); 2 = a
 * blob already in `static/img` has different bytes (hash-prefix collision).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

import {fenceMask} from '../translate/lib/blocks.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STATIC_DIR = path.join(REPO, 'static');
const IMG_DIR = path.join(STATIC_DIR, 'img');

/** Content trees whose references are rewritten and whose copies are pruned. */
const ROOTS = ['docs', 'versioned_docs', 'hardware', 'blog', 'changelog', 'i18n'];

/**
 * Read-only trees: they may name a content image, and a name is enough to keep
 * the file (the rewrite never touches them, so the file it points at must stay).
 */
const AUX_ROOTS = ['src', 'corrections', 'config', 'data', 'guides', 'upstream', 'static/assets'];
const AUX_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'TRANSLATION.md',
  'docusaurus.config.ts',
  'sidebars.ts',
  'sidebars-hardware.ts',
  'versions.json',
];

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.ico', '.bmp']);
const MARKDOWN_EXT = new Set(['.md', '.mdx']);
const AUX_EXT = new Set([...MARKDOWN_EXT, '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.html', '.htm', '.css']);

/** Named by `docusaurus.config.ts`; never hashed, never deleted. */
const PROTECTED_STATIC = new Set(['logo.svg', 'favicon.svg']);

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.docusaurus', '.work', 'work', '.cache-loader']);

const WRITE = process.argv.includes('--write') && !process.argv.includes('--dry-run');

const text = (value) => String(value);

// ---------------------------------------------------------------------------
// Protected regions: fenced code, inline code and MDX/HTML comments all carry
// text that *looks* like a reference (`cmr.md` documents a screenshot inside a
// `{/* … */}` placeholder). Rewriting one would edit documentation about a
// reference instead of a reference — and deleting its file would be worse.
// ---------------------------------------------------------------------------

/**
 * A per-character mask: 1 = inside a region the rewrite must not touch.
 *
 * Fenced code uses `fenceMask` from the translation library, which is the one
 * definition the rest of the pipeline trusts: the official pages open fences
 * *inside list items* (`9. \`\`\`ros`), and a line regex that only accepts a
 * fence at the start of a line desynchronises there. That desync is not
 * theoretical — it hides the prose between two list-item fences, so a real
 * reference looks like documentation about a reference and its file would be
 * deleted. `fenceMask` has handled that shape since the block segmenter needed
 * it.
 *
 * Inline code is matched on one line only. CommonMark allows a code span to
 * cross a newline, but an unbalanced backtick in prose would then mask the rest
 * of the file, silently hiding real references from the `missing` check.
 */
function protectedMask(source) {
  const length = source.length;
  const mask = new Uint8Array(length);

  const frontMatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (frontMatter) mask.fill(1, 0, frontMatter[0].length);

  // Fenced code: `fenceMask` answers per line, the mask is per character.
  const fenced = fenceMask(source);
  let pos = 0;
  for (let line = 0; line < fenced.length; line++) {
    const newline = source.indexOf('\n', pos);
    const end = newline === -1 ? length : newline;
    if (fenced[line]) mask.fill(1, pos, end);
    if (newline === -1) break;
    pos = newline + 1;
  }

  // Comments and inline code, inside whatever the fence pass left untouched.
  let index = 0;
  while (index < length) {
    if (mask[index]) {
      index++;
      continue;
    }
    if (source.startsWith('{/*', index)) {
      const end = source.indexOf('*/}', index + 3);
      if (end !== -1) {
        mask.fill(1, index, end + 3);
        index = end + 3;
        continue;
      }
    }
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      if (end !== -1) {
        mask.fill(1, index, end + 3);
        index = end + 3;
        continue;
      }
    }
    if (source[index] === '`') {
      let run = 0;
      while (source[index + run] === '`') run++;
      let cursor = index + run;
      let close = -1;
      while (cursor < length && source[cursor] !== '\n') {
        if (mask[cursor]) break;
        if (source[cursor] === '`') {
          let inner = 0;
          while (source[cursor + inner] === '`') inner++;
          if (inner === run) {
            close = cursor;
            break;
          }
          cursor += inner;
          continue;
        }
        cursor++;
      }
      if (close !== -1) {
        mask.fill(1, index, close + run);
        index = close + run;
        continue;
      }
      index += run;
      continue;
    }
    index++;
  }

  return mask;
}

// ---------------------------------------------------------------------------
// Reference discovery
// ---------------------------------------------------------------------------

/** `![alt](target)`, with an optional `"title"` after the target. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(<[^>\n]*>|[^)\s]+)/g;
/** `[text](target)`; the negative lookbehind skips the `!` of an image. */
const MARKDOWN_LINK = /(?<!\!)\]\(\s*(<[^>\n]*>|[^)\s]+)/g;
/** Any tag; attributes are read from the captured body. */
const TAG = /<([A-Za-z][A-Za-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
/** Quoted attribute values only; a JSX expression is dynamic and is skipped. */
const ATTRIBUTE = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gd;
const URL_ATTRIBUTES = new Set(['src', 'poster']);
const SRCSET_ATTRIBUTES = new Set(['srcset']);

/**
 * Every image-shaped reference in one document, with the exact byte range of
 * the URL text so the rewrite can splice it without re-serialising the file.
 *
 * `kind` decides how an unresolvable target is treated: an `image` or `link`
 * target is a real reference (`missing`), while an attribute on a non-image tag
 * (`<video src>`, `<source poster>`) is only rewritten when it points at an
 * image file and is otherwise ignored.
 */
function findReferences(source, {loose = false} = {}) {
  // `loose` ignores the protected regions: used only to prove that a file is
  // *mentioned* somewhere (even inside a code sample), which is enough reason
  // not to delete it.
  const mask = loose ? new Uint8Array(source.length) : protectedMask(source);
  const refs = [];
  const add = (start, end, url, kind) => {
    if (start < 0 || end <= start || mask[start]) return;
    refs.push({start, end, url, kind});
  };

  for (const match of source.matchAll(MARKDOWN_IMAGE)) {
    const raw = match[1];
    const start = match.index + match[0].length - raw.length;
    const url = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
    add(start, start + raw.length, url, 'image');
  }

  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const raw = match[1];
    const start = match.index + match[0].length - raw.length;
    const url = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
    add(start, start + raw.length, url, 'link');
  }

  for (const match of source.matchAll(TAG)) {
    const body = match[2];
    const bodyStart = match.index + match[0].indexOf(body);
    for (const attribute of body.matchAll(ATTRIBUTE)) {
      const name = attribute[1].toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? '';
      const indices = attribute.indices[2] ?? attribute.indices[3];
      if (!indices) continue;
      const valueStart = bodyStart + indices[0];
      if (URL_ATTRIBUTES.has(name)) {
        add(valueStart, valueStart + value.length, value, 'attribute');
      } else if (SRCSET_ATTRIBUTES.has(name)) {
        // `url 1x, url 2x`: rewrite each candidate, keep the descriptors.
        let offset = 0;
        for (const candidate of value.split(',')) {
          const leading = candidate.length - candidate.trimStart().length;
          const trimmed = candidate.trim();
          const url = trimmed.split(/\s+/)[0];
          if (url) add(valueStart + offset + leading, valueStart + offset + leading + url.length, url, 'attribute');
          offset += candidate.length + 1;
        }
      }
    }
  }

  // `![alt](url)` also looks like a link to the pattern above (the lookbehind
  // only excludes the empty-alt form): both passes see the same URL range. The
  // image pass owns it, so the weaker duplicate is dropped instead of rewriting
  // the same bytes twice.
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.start}:${ref.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Resolution and blob naming
// ---------------------------------------------------------------------------

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function extensionOf(target) {
  return path.extname(target.split(/[?#]/)[0]).toLowerCase();
}

function isImageFile(file) {
  return IMAGE_EXT.has(path.extname(file).toLowerCase());
}

function splitSuffix(url) {
  const cut = url.search(/[?#]/);
  return cut === -1 ? {pathname: url, suffix: ''} : {pathname: url.slice(0, cut), suffix: url.slice(cut)};
}

/** The file a reference names, or `null` when it cannot be a local image. */
function resolveReference(sourceFile, url) {
  if (!url || EXTERNAL.test(url)) return null;
  const {pathname} = splitSuffix(url);
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded) return null;
  const target = decoded.startsWith('/')
    ? path.join(STATIC_DIR, decoded)
    : path.resolve(path.dirname(sourceFile), decoded);
  const relative = path.relative(REPO, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(target)) return {target, exists: false};
  if (!fs.statSync(target).isFile()) return null;
  return {target, exists: true};
}

/**
 * The English page an overlay mirrors, or `null` for a page that is not an
 * overlay.
 *
 * A translated page is a mirror of one English page, but a handful of its
 * relative references were written against the *English* page's folder (the
 * `[![](img/a.png)](img/a.png)` thumbnails: the image was rebased, the link was
 * not). Trying the same relative path next to the English page is the same
 * fallback `rebase-overlay.mjs` uses, and it is only consulted after the
 * overlay-local path failed to resolve, so it can never shadow a real file.
 */
function mirroredEnglishPage(file) {
  const rel = path.relative(REPO, file).split(path.sep).join('/');
  const match = /^i18n\/[^/]+\/docusaurus-plugin-content-(docs-hardware|docs)\/(current|version-[\d.]+)\/(.+)$/.exec(rel);
  if (!match) return null;
  const [, plugin, version, tail] = match;
  if (plugin === 'docs-hardware') return path.join(REPO, 'hardware', tail);
  return version === 'current'
    ? path.join(REPO, 'docs', tail)
    : path.join(REPO, 'versioned_docs', version, tail);
}

const blobCache = new Map();

/** `sha256(bytes)[:16]` + the lower-cased extension, or `null` for a non-image. */
function blobOf(target) {
  if (blobCache.has(target)) return blobCache.get(target);
  let blob = null;
  if (isImageFile(target)) {
    const bytes = fs.readFileSync(target);
    blob = {
      name: `${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)}${path.extname(target).toLowerCase()}`,
      bytes,
    };
  }
  blobCache.set(target, blob);
  return blob;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

function walk(root, extensionFilter, visit) {
  if (!fs.existsSync(root)) return;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile() && extensionFilter(path.extname(entry.name).toLowerCase())) {
        visit(full);
      }
    }
  }
}

function contentImageFiles() {
  const files = [];
  for (const root of ROOTS) walk(path.join(REPO, root), (extension) => IMAGE_EXT.has(extension), (file) => files.push(file));
  return files;
}

function markdownFiles() {
  const files = [];
  for (const root of ROOTS) walk(path.join(REPO, root), (extension) => MARKDOWN_EXT.has(extension), (file) => files.push(file));
  return files;
}

/**
 * Files the rewrite never touches. A content image they name is kept, because
 * deleting it would break a reference this tool does not own.
 */
function auxiliaryReferences() {
  const keep = new Set();
  const note = (file) => {
    for (const ref of findReferences(fs.readFileSync(file, 'utf8'))) {
      const resolved = resolveReference(file, ref.url);
      if (resolved?.exists) keep.add(resolved.target);
    }
  };
  for (const root of AUX_ROOTS) walk(path.join(REPO, root), (extension) => AUX_EXT.has(extension), note);
  for (const name of AUX_FILES) {
    const file = path.join(REPO, name);
    if (fs.existsSync(file)) note(file);
  }
  return keep;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const files = markdownFiles();
const images = contentImageFiles();
const bytesBefore = images.reduce((total, file) => total + fs.statSync(file).size, 0);

/** Blobs already stored, so `moved` counts copies, not references. */
const stored = new Set(fs.readdirSync(IMG_DIR));
for (const name of PROTECTED_STATIC) stored.add(name);

const planned = [];      // blobs to copy: {target, name, bytes}
const plannedNames = new Set();
const edits = new Map(); // file -> [{start, end, replacement}]
const examples = [];
const missing = [];
const collisions = [];
const nonImage = [];
const referencedFiles = new Set();
const refsByKind = {image: 0, link: 0, attribute: 0};
let refs = 0;
let reused = 0;
let moved = 0;

function rememberExample(kind, file, before, after) {
  if (examples.length >= 200) return;
  examples.push({kind, file: path.relative(REPO, file), before, after});
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const fileEdits = [];
  for (const ref of findReferences(source)) {
    if (!ref.url || EXTERNAL.test(ref.url)) continue;
    // What a reference can mean: an image reference is always an image; a
    // link or an attribute is only ours when it names an image file (a
    // `<video src>` or a Markdown page link is another tool's business).
    const imageShaped = ref.kind === 'image' || isImageFile(splitSuffix(ref.url).pathname);
    let resolved = resolveReference(file, ref.url);
    if ((!resolved || !resolved.exists) && !ref.url.startsWith('/')) {
      const mirrored = mirroredEnglishPage(file);
      if (mirrored) {
        const candidate = resolveReference(mirrored, ref.url);
        if (candidate?.exists) resolved = candidate;
      }
    }
    if (!resolved || !resolved.exists) {
      if (imageShaped) missing.push(`${path.relative(REPO, file)}: ${ref.url}`);
      continue;
    }
    referencedFiles.add(resolved.target);
    const blob = blobOf(resolved.target);
    if (!blob) {
      // Resolves to a real file that is not an image: a page link or a video.
      if (imageShaped && ref.kind !== 'attribute') nonImage.push(`${path.relative(REPO, file)}: ${ref.url}`);
      continue;
    }
    refs++;
    refsByKind[ref.kind]++;
    const {suffix} = splitSuffix(ref.url);
    const replacement = `/img/${blob.name}${suffix}`;
    if (ref.url === replacement) {
      reused++;
      continue;
    }
    if (!stored.has(blob.name)) {
      stored.add(blob.name);
      moved++;
      plannedNames.add(blob.name);
      planned.push({target: resolved.target, name: blob.name, bytes: blob.bytes});
    } else {
      reused++;
      const destination = path.join(IMG_DIR, blob.name);
      if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(blob.bytes)) {
        collisions.push(path.relative(REPO, destination));
      }
    }
    fileEdits.push({start: ref.start, end: ref.end, replacement});
    rememberExample(ref.kind, file, ref.url, replacement);
  }
  if (fileEdits.length) edits.set(file, fileEdits);
}

// A blob that is already stored was either verified above (referenced) or is
// unreferenced; the latter is not this tool's business (verify:orphan-assets).
for (const entry of planned) {
  const destination = path.join(IMG_DIR, entry.name);
  if (!fs.existsSync(destination)) continue;
  if (!fs.readFileSync(destination).equals(entry.bytes)) collisions.push(path.relative(REPO, destination));
}

// Deletion: every page-local image becomes unreferenced once the rewrite lands.
// The bytes are in `static/img` first (staged above), so this order is safe even
// if the process dies between the two phases.
const keepByAux = auxiliaryReferences();
// A picture whose only mention lives inside a code sample or an MDX comment is
// not a rendered image, but the file is still part of the page's text. Keep it:
// the rewrite does not touch that region, so deleting the file would leave the
// sample pointing at nothing.
const mentioned = new Set();
for (const file of files) {
  for (const ref of findReferences(fs.readFileSync(file, 'utf8'), {loose: true})) {
    const resolved = resolveReference(file, ref.url);
    if (resolved?.exists) mentioned.add(resolved.target);
  }
}
const keptMasked = images.filter((file) => mentioned.has(file) && !referencedFiles.has(file));
const deleted = [];
const kept = [];
const unreferenced = images.filter((file) => !referencedFiles.has(file));
for (const file of images) {
  if (keepByAux.has(file) || keptMasked.includes(file)) {
    kept.push(file);
    continue;
  }
  deleted.push(file);
}
const deletedBytes = deleted.reduce((total, file) => total + fs.statSync(file).size, 0);

/**
 * `static/img` must hold exactly the blobs the pages point at: no more (an
 * unreferenced file is a copy of a picture nobody shows, and
 * `verify:orphan-assets` reports it) and no fewer.
 *
 * Pruning lives here rather than in the sync stage order because the blob is a
 * *derived* file: a page removed by `prune-orphans` takes its blobs with it, and
 * the only place that knows the full reference set is this scan. `logo.svg` and
 * `favicon.svg` are named by `docusaurus.config.ts`, not by a page, and are
 * never touched.
 */
const referencedBlobs = new Set([...referencedFiles, ...keepByAux]);
const staticOrphans = [];
for (const name of fs.readdirSync(IMG_DIR)) {
  if (PROTECTED_STATIC.has(name)) continue;
  const file = path.join(IMG_DIR, name);
  if (!fs.statSync(file).isFile()) continue;
  if (!referencedBlobs.has(file)) staticOrphans.push(file);
}

const uniqueBlobs = new Set();
for (const file of images) {
  const blob = blobOf(file);
  if (blob) uniqueBlobs.add(blob.name);
}
const bytesAfter = kept.reduce((total, file) => total + fs.statSync(file).size, 0);
const blobBytes = planned.reduce((total, entry) => total + entry.bytes.length, 0);

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function write() {
  fs.mkdirSync(IMG_DIR, {recursive: true});
  for (const entry of planned) {
    const destination = path.join(IMG_DIR, entry.name);
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, entry.bytes);
  }
  for (const [file, fileEdits] of edits) {
    const source = fs.readFileSync(file, 'utf8');
    let next = source;
    for (const edit of [...fileEdits].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
    }
    if (next !== source) fs.writeFileSync(file, next);
  }
  for (const file of staticOrphans) fs.rmSync(file, {force: true});
  const directories = new Set();
  for (const file of deleted) {
    fs.rmSync(file, {force: true});
    directories.add(path.dirname(file));
  }
  // Only directories this run emptied, bottom-up; `_category_.json` stays (the
  // sidebar still names that key), so an image folder with one is not empty.
  const insideContentRoot = (directory) =>
    ROOTS.some((root) => {
      const base = path.join(REPO, root);
      return directory === base || directory.startsWith(`${base}${path.sep}`);
    });
  for (const directory of [...directories].sort((a, b) => b.length - a.length)) {
    let current = directory;
    while (insideContentRoot(current)) {
      if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) break;
      fs.rmdirSync(current);
      current = path.dirname(current);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report = {
  mode: WRITE ? 'write' : 'dry-run',
  images: images.length,
  unique: uniqueBlobs.size,
  refs,
  reused,
  moved: planned.length,
  deleted: deleted.length,
  kept: kept.length,
  missing: missing.length,
  collisions: collisions.length,
  bytesBefore,
  bytesAfter,
  blobBytes,
  deletedBytes,
  unreferenced: unreferenced.length,
  staticPruned: staticOrphans.length,
  refsByKind,
  files: files.length,
  filesChanged: edits.size,
};

console.log(
  `images=${report.images} unique=${report.unique} reused=${report.reused} moved=${report.moved} ` +
    `bytesBefore=${report.bytesBefore} bytesAfter=${report.bytesAfter} refs=${report.refs} ` +
    `deleted=${report.deleted} kept=${report.kept} missing=${report.missing} ` +
    `unreferenced=${report.unreferenced} staticPruned=${report.staticPruned} ` +
    `refsByKind=${JSON.stringify(report.refsByKind)} ` +
    `files=${report.files} changed=${report.filesChanged} mode=${report.mode}`,
);

const KINDS = ['image', 'link', 'attribute'];
for (const kind of KINDS) {
  const item = examples.find((entry) => entry.kind === kind);
  if (item) console.log(`  sample ${kind}: ${item.file}\n    ${item.before}\n    -> ${item.after}`);
}
const withFragment = examples.find((entry) => entry.before.includes('#'));
if (withFragment) {
  console.log(`  sample fragment: ${withFragment.file}\n    ${withFragment.before}\n    -> ${withFragment.after}`);
}
for (const item of examples.slice(0, 20)) {
  console.log(`  ${item.kind.padEnd(9)} ${item.file}\n    ${item.before}\n    -> ${item.after}`);
}
if (examples.length > 20) console.log(`  ... and ${examples.length - 20} more sample(s)`);
if (missing.length) {
  console.log(`\nmissing=${missing.length}`);
  for (const line of missing.slice(0, 20)) console.log(`  MISSING ${line}`);
  if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
}
if (nonImage.length) {
  console.log(`non-image attribute targets left alone: ${nonImage.length}`);
}
if (collisions.length) {
  console.log(`\ncollisions=${collisions.length}`);
  for (const line of collisions.slice(0, 10)) console.log(`  COLLISION ${line}`);
}

if (report.missing > 0 || report.collisions > 0) {
  console.log('\nrefusing to change anything: every reference must resolve first');
  process.exit(report.collisions > 0 ? 2 : 1);
}

if (!WRITE) {
  console.log(`\ndry-run: ${planned.length} blob(s) to copy (${blobBytes} bytes), ${deleted.length} file(s) to delete (${deletedBytes} bytes), ${edits.size} file(s) to rewrite`);
  for (const file of deleted.slice(0, 10)) console.log(`  DELETE ${path.relative(REPO, file)}`);
  if (deleted.length > 10) console.log(`  ... and ${deleted.length - 10} more`);
  for (const file of staticOrphans) console.log(`  PRUNE  ${path.relative(REPO, file)}`);
  process.exit(0);
}

write();
console.log(
  `written: ${planned.length} blob(s) copied (${blobBytes} bytes), ${edits.size} file(s) rewritten, ` +
    `${deleted.length} file(s) deleted (${deletedBytes} bytes), ${staticOrphans.length} static blob(s) pruned`,
);
