#!/usr/bin/env node
/**
 * `npm run verify:addressing-ready` — hub-only preflight for image addressing.
 *
 * This assertion sits after `materialize` and before `assets` in a `sync
 * --update` run. At that point the only thing that can already be decided is
 * the *addressed* form: a `/img/<sha256-prefix>.<ext>` reference must have its
 * blob in `static/img/`, otherwise materialize dropped a hash reference that
 * no later stage can recover. That is the sole fail-closed condition here.
 *
 * On a cold start materialize legitimately restores relative `./img/<name>`
 * references while the page-local copies are still absent — the previous
 * `address-images` run deleted them, and the `assets` stage is precisely what
 * downloads them again before `address-images` hashes and rewrites them. So
 * relative references and root-absolute `/assets/images/...` references are
 * counted for visibility only; they are informational and never fail this
 * gate. Only missing blobs get listed, with exit 1.
 *
 * Only `docs/` and `versioned_docs/` are scanned: those are the two trees
 * materialize writes in a sync run. Fenced code, inline code and comments are
 * masked out, exactly as `address-images` does, so documentation *about* an
 * image path is not mistaken for a reference. The check is read-only; it never
 * repairs a file or relaxes `address-images` fail-closed behaviour.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {fenceMask} from '../translate/lib/blocks.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = ['docs', 'versioned_docs'];
const STATIC_IMG = path.join(REPO, 'static', 'img');
const MARKDOWN_EXT = new Set(['.md', '.mdx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.docusaurus', '.work', 'work']);

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(<[^>\n]*>|[^)\s]+)/g;
const MARKDOWN_LINK = /(?<!\!)\]\(\s*(<[^>\n]*>|[^)\s]+)/g;
const TAG = /<([A-Za-z][A-Za-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gd;
const URL_ATTRIBUTES = new Set(['src', 'poster']);
const SRCSET_ATTRIBUTES = new Set(['srcset']);

/** Code fences, inline code, comments and front matter are not references. */
function protectedMask(source) {
  const mask = new Uint8Array(source.length);
  const frontMatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (frontMatter) mask.fill(1, 0, frontMatter[0].length);

  const fenced = fenceMask(source);
  let position = 0;
  for (let line = 0; line < fenced.length; line++) {
    const newline = source.indexOf('\n', position);
    const end = newline === -1 ? source.length : newline;
    if (fenced[line]) mask.fill(1, position, end);
    if (newline === -1) break;
    position = newline + 1;
  }

  for (let index = 0; index < source.length;) {
    if (mask[index]) {
      index++;
      continue;
    }
    const comment = source.startsWith('{/*', index) ? '*/}' : source.startsWith('<!--', index) ? '-->' : null;
    if (comment) {
      const end = source.indexOf(comment, index + 3);
      if (end !== -1) {
        mask.fill(1, index, end + comment.length);
        index = end + comment.length;
        continue;
      }
    }
    if (source[index] === '`') {
      let run = 0;
      while (source[index + run] === '`') run++;
      let cursor = index + run;
      let close = -1;
      while (cursor < source.length && source[cursor] !== '\n') {
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

/** Every URL in a Markdown page, in source order. */
function referencesOf(source) {
  const mask = protectedMask(source);
  const refs = [];
  const add = (start, raw, kind) => {
    if (start < 0 || !raw || mask[start]) return;
    const url = raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
    refs.push({start, url, kind});
  };
  for (const match of source.matchAll(MARKDOWN_IMAGE)) {
    const raw = match[1];
    add(match.index + match[0].length - raw.length, raw, 'image');
  }
  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const raw = match[1];
    add(match.index + match[0].length - raw.length, raw, 'link');
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
      if (URL_ATTRIBUTES.has(name)) add(valueStart, value, 'attribute');
      else if (SRCSET_ATTRIBUTES.has(name)) {
        let offset = 0;
        for (const candidate of value.split(',')) {
          const leading = candidate.length - candidate.trimStart().length;
          const url = candidate.trim().split(/\s+/)[0];
          if (url) add(valueStart + offset + leading, url, 'attribute');
          offset += candidate.length + 1;
        }
      }
    }
  }
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.start}:${ref.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function markdownFiles() {
  const files = [];
  for (const root of ROOTS) {
    const base = path.join(REPO, root);
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) stack.push(full);
        } else if (entry.isFile() && MARKDOWN_EXT.has(path.extname(entry.name).toLowerCase())) {
          files.push(full);
        }
      }
    }
  }
  return files.sort();
}

const stats = {files: 0, blobRefs: 0, localRefs: 0, rootAssetRefs: 0, missing: 0};
const missing = [];

for (const file of markdownFiles()) {
  stats.files++;
  const source = fs.readFileSync(file, 'utf8');
  for (const ref of referencesOf(source)) {
    const bare = ref.url.split(/[?#]/)[0];
    let decoded = bare;
    let undecodable = false;
    try {
      decoded = decodeURIComponent(bare);
    } catch {
      undecodable = true;
    }
    // Classify even an undecodable URL: a relative reference stays informational.
    const target = undecodable ? bare : decoded;

    if (target.startsWith('./img/')) {
      // Informational: `assets` fetches the page-local copy and `address-images`
      // later addresses it. On a cold start the copy is absent by design.
      stats.localRefs++;
      continue;
    }
    if (target.startsWith('/assets/images/')) {
      // Informational: mirrored by fetch-assets' root-absolute pass, not by
      // static/img; the count only makes a regression to raw site URLs visible.
      stats.rootAssetRefs++;
      continue;
    }
    if (undecodable) {
      // An undecodable non-relative URL cannot name a blob; report it.
      missing.push(`${path.relative(REPO, file)}: ${ref.url} (undecodable)`);
      stats.missing++;
      continue;
    }
    if (!target.startsWith('/img/')) continue;

    // The only fail-closed check: an already-addressed reference must resolve
    // to a blob before the ~54-minute asset stage starts.
    stats.blobRefs++;
    const blob = path.join(STATIC_IMG, target.slice('/img/'.length));
    if (!fs.existsSync(blob) || !fs.statSync(blob).isFile()) {
      missing.push(`${path.relative(REPO, file)}: ${ref.url} -> ${path.relative(REPO, blob)} (blob missing)`);
      stats.missing++;
    }
  }
}

console.log(
  `addressing-ready: files=${stats.files} blob_refs=${stats.blobRefs} local_refs=${stats.localRefs} ` +
    `root_asset_refs=${stats.rootAssetRefs} missing=${stats.missing}`,
);
if (stats.missing > 0) {
  console.log('addressing-ready: unresolved references (first 50 shown):');
  for (const line of missing.slice(0, 50)) console.log(`  MISSING ${line}`);
  if (missing.length > 50) console.log(`  ... and ${missing.length - 50} more`);
  process.exit(1);
}
console.log('addressing-ready: PASS');
