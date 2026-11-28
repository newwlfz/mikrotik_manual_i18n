#!/usr/bin/env node
/**
 * Component images must survive translation.
 *
 * The hardware pages carry their product pictures as MDX components
 * (`<Img src="/img/....webp" alt="" width={799} height={559} />`), not as
 * markdown images, so `tools/translate/lib/verify.mjs` never compared them: its
 * image check only reads `![alt](url)`. The 7.26 Chinese capture dropped every
 * component block, the `exactOnly` rebuild replaced the page with that capture,
 * and 73 hardware pages silently lost all of their pictures while the
 * structural verifier stayed green.
 *
 * This verifier compares the component-image count of every English hardware
 * page with its Chinese overlay. A page without an overlay is reported as
 * untranslated (no assertion), because there is nothing to compare.
 *
 * ## MIME mismatch hard gate (issue 5)
 *
 * Four content-addressed blobs in `static/img/` carry a `.png` name but are
 * actually JPEG (ffd8ffe0) or RIFF/WebP. Their names are already referenced by
 * Markdown, so they must NOT be renamed: this check sniffs the real format and
 * fails on extension/format disagreement in `static/img/` and `build/img/`.
 * `--allow-mime-mismatch` temporarily allows the pre-existing files
 * (5 in this checkout: the 4 recorded in the brief plus a byte-identical
 * `.webp` duplicate of one of them); it does not hide the count or the names.
 */

import fs from 'node:fs';
import path from 'node:path';
import {REPO, DEFAULT_TARGET_LOCALE, overlayRootFor, walkMarkdown, relative} from '../translate/lib/paths.mjs';

const SOURCE = path.join(REPO, 'hardware');
// The overlay belongs to THIS checkout's locale. `overlayRootFor` is the single
// place that assembles an i18n path (translate/lib/paths.mjs), and each locale
// repository supplies its own DEFAULT_TARGET_LOCALE (the template keeps the
// `{{LOCALE}}` scaffold placeholder, substituted by `locale:add`).
const OVERLAY = path.join(REPO, overlayRootFor(DEFAULT_TARGET_LOCALE, 'hardware'));
const IMAGE = /<Img\b|<img\b/gi;

/** Extension -> sniffed formats that are legal for it. */
const EXT_EXPECTED = new Map([
  ['.png', new Set(['png'])],
  ['.jpg', new Set(['jpeg'])],
  ['.jpeg', new Set(['jpeg'])],
  ['.webp', new Set(['webp'])],
  ['.gif', new Set(['gif'])],
  ['.svg', new Set(['svg'])],
  ['.avif', new Set(['avif', 'heic'])],
  ['.heic', new Set(['heic', 'avif'])],
  ['.ico', new Set(['ico'])],
  ['.bmp', new Set(['bmp'])],
  ['.tif', new Set(['tiff'])],
  ['.tiff', new Set(['tiff'])],
]);

function parseArgs(argv) {
  const opts = {
    allowMimeMismatch: false,
    json: false,
    staticImg: path.join(REPO, 'static', 'img'),
    buildImg: path.join(REPO, 'build', 'img'),
    // Internal test hook for the static recurrence guard below: point it at an
    // offline fixture tree. Defaults to this repository's tools/verify.
    verifyToolsDir: path.join(REPO, 'tools', 'verify'),
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'usage: node tools/verify/images.mjs [--allow-mime-mismatch] [--json]',
          '       [--static=<dir>] [--build=<dir>] [--verify-tools-dir=<dir>]',
          '',
          '  --allow-mime-mismatch  report but do not fail on extension/format mismatch',
          '  --static=<dir>         static/img directory (default: <repo>/static/img)',
          '  --build=<dir>          build/img directory (default: <repo>/build/img)',
          '  --verify-tools-dir=<dir>  scan this tree for hardcoded overlay paths',
          '                         (internal fixture hook; default: <repo>/tools/verify)',
          '  --json                 emit the machine-readable report',
        ].join('\n'),
      );
      process.exit(0);
    }
    if (arg === '--allow-mime-mismatch') opts.allowMimeMismatch = true;
    else if (arg === '--json') opts.json = true;
    else if (arg.startsWith('--static=')) {
      opts.staticImg = path.resolve(process.cwd(), arg.slice('--static='.length));
    } else if (arg.startsWith('--build=')) {
      opts.buildImg = path.resolve(process.cwd(), arg.slice('--build='.length));
    } else if (arg.startsWith('--verify-tools-dir=')) {
      opts.verifyToolsDir = path.resolve(process.cwd(), arg.slice('--verify-tools-dir='.length));
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

/** Sniff a real image format from the first bytes; null means "unknown". */
function sniffFormat(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(4096);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, read);
    if (
      head.length >= 8 &&
      head[0] === 0x89 && head.toString('ascii', 1, 4) === 'PNG' &&
      head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
    ) return 'png';
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
    if (
      head.length >= 6 && head.toString('ascii', 0, 3) === 'GIF' &&
      ['87a', '89a'].includes(head.toString('ascii', 3, 6))
    ) return 'gif';
    if (
      head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' &&
      head.toString('ascii', 8, 12) === 'WEBP'
    ) return 'webp';
    if (head.length >= 12 && head.toString('ascii', 4, 8) === 'ftyp') {
      const brand = head.toString('ascii', 8, 12);
      if (/^(avif|avis)$/.test(brand)) return 'avif';
      if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return 'heic';
    }
    if (head.length >= 2 && head[0] === 0x42 && head[1] === 0x4d) return 'bmp';
    if (head.length >= 4 && head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return 'ico';
    if (head.length >= 4 && (
      (head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0) ||
      (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0 && head[3] === 0x2a)
    )) return 'tiff';
    const text = head.toString('utf8').replace(/^\uFEFF/, '').trimStart();
    if (/^<svg\b/i.test(text) || (/^<\?xml\b/i.test(text) && /<svg\b/i.test(text))) return 'svg';
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function componentImages(body) {
  return [...String(body).matchAll(IMAGE)].map((match) => match[0]);
}

/**
 * Static recurrence guard (assertion layer).
 *
 * Scan every verify tool for a baked-in overlay path such as a literal
 * `i18n/<one locale>/...`. A new locale repo would otherwise silently get
 * pages=0 from this very tool. Comments are stripped first: they legitimately
 * cite the historical path. The needle is assembled at runtime so this file
 * never contains the literal it searches for.
 */
function hardcodedOverlayHits(scanRoot) {
  const needle = ['i18n', 'zh-Hans'].join('/');
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'fixtures', '__fixtures__'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        const code = fs
          .readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (code.includes(needle)) hits.push(path.relative(REPO, full) || full);
      }
    }
  };
  walk(scanRoot);
  return hits;
}

/** Scan one img directory; absent directories are a no-op (locale repos). */
function scanImgDir(dir, label, mime) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  mime.dirsScanned.push(label);
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const expected = EXT_EXPECTED.get(ext);
    if (!expected) continue;
    const file = path.join(dir, entry.name);
    const actual = sniffFormat(file);
    if (actual === null) {
      mime.unknown += 1;
      continue;
    }
    mime.sniffed += 1;
    if (!expected.has(actual)) {
      mime.mismatches.push({
        path: path.relative(REPO, file) || file,
        extension: ext,
        actual,
      });
    }
  }
}

const opts = parseArgs(process.argv.slice(2));

// Assertion layer: fail if any verify tool reintroduces a single-locale
// overlay literal. Runs on every invocation, in every locale repository.
const staticHits = hardcodedOverlayHits(opts.verifyToolsDir);
if (staticHits.length) {
  console.error(
    `verify-static-guard: hardcoded ${['i18n', 'zh-Hans'].join('/')} overlay path in ${staticHits.join(', ')}`,
  );
}

const failures = [];
let pages = 0;
let untranslated = 0;
let images = 0;

for (const file of walkMarkdown(SOURCE)) {
  const rel = relative(SOURCE, file);
  const english = componentImages(fs.readFileSync(file, 'utf8'));
  const overlayFile = path.join(OVERLAY, rel);
  if (!fs.existsSync(overlayFile)) {
    untranslated++;
    continue;
  }
  pages++;
  images += english.length;
  const chinese = componentImages(fs.readFileSync(overlayFile, 'utf8'));
  if (english.length !== chinese.length) {
    failures.push(`${rel}: en=${english.length} zh=${chinese.length}`);
  }
}

const mime = {dirsScanned: [], sniffed: 0, unknown: 0, mismatches: []};
scanImgDir(opts.staticImg, 'static/img', mime);
scanImgDir(opts.buildImg, 'build/img', mime);
const mimeFailed = mime.mismatches.length > 0 && !opts.allowMimeMismatch;
const hardware = {pages, images, untranslated, mismatched: failures.length, failures};

if (opts.json) {
  console.log(
    JSON.stringify(
      {
        hardware,
        mime: {
          dirsScanned: mime.dirsScanned,
          sniffed: mime.sniffed,
          unknown: mime.unknown,
          mismatched: mime.mismatches.length,
          mismatches: mime.mismatches,
          allowMimeMismatch: opts.allowMimeMismatch,
          failed: mimeFailed,
        },
        ok: failures.length === 0 && !mimeFailed && staticHits.length === 0,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `  ${failures.length ? 'FAIL' : 'ok  '} hardware component images: ` +
      JSON.stringify(hardware),
  );
  if (failures.length) {
    for (const line of failures.slice(0, 10)) console.log(`FAIL ${line}`);
    if (failures.length > 10) console.log(`FAIL ... and ${failures.length - 10} more page(s)`);
  }
  const status = mimeFailed ? 'FAIL' : mime.mismatches.length ? 'WARN' : 'ok  ';
  console.log(
    `  ${status} image mime/extension: ` +
      JSON.stringify({
        dirs: mime.dirsScanned,
        sniffed: mime.sniffed,
        unknown: mime.unknown,
        mismatched: mime.mismatches.length,
        allowed: opts.allowMimeMismatch,
      }),
  );
  for (const item of mime.mismatches.slice(0, 20)) {
    console.log(`${mimeFailed ? 'FAIL' : 'WARN'} MIME ${item.path}: extension ${item.extension} but actual ${item.actual}`);
  }
  if (mime.mismatches.length > 20) {
    console.log(`  ... and ${mime.mismatches.length - 20} more mismatch(es)`);
  }
}

if (failures.length > 0 || mimeFailed || staticHits.length > 0) process.exitCode = 1;
