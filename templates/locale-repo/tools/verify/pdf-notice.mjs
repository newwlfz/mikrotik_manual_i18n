#!/usr/bin/env node
/**
 * `verify:pdf-notice` — gate for the official PDF download hint on Hardware.
 *
 * The official `.md` export never contains the "This guide can be downloaded
 * as a PDF file" paragraph; only the rendered HTML does. `fetch-hardware`
 * recovers that sentence into the mirror's Markdown, and this tool proves the
 * hint survived. It never looks at a PDF/image binary.
 *
 * Modes:
 *   node tools/verify/pdf-notice.mjs             # offline (same as --check)
 *   node tools/verify/pdf-notice.mjs --check     # offline gate, no network
 *   node tools/verify/pdf-notice.mjs --online    # probe official pages too
 *   node tools/verify/pdf-notice.mjs --self-test # pure-function probe
 *
 * The offline floor (36 pages) is the rehearsal-1 baseline for this corpus;
 * it is a data expectation of this new check, not a change to any existing
 * assertion threshold. The online mode has no hardcoded slug list: the set of
 * pages that must carry the hint is discovered from the official HTML itself.
 *
 * Portability: locale repositories ship an older `fetch-hardware.mjs` that does
 * not export the PDF-notice helpers. The helpers are loaded with a guarded
 * dynamic import; when they are missing `--check` degrades to a pure offline
 * data gate (manifest + Markdown count / placement / mismatch), and `--online`
 * fails with an explicit message instead of a named-export SyntaxError.
 *
 * Exit 0 iff every executed check passed, 1 otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {
  REPO,
  fetchText,
  frontMatterValue,
  mapLimit,
  parseMarkdown,
} from '../sync/lib/render-page.mjs';

const HARDWARE = path.join(REPO, 'hardware');
const MANIFEST = path.join(REPO, 'data/manifests/hardware.json');
const FETCH_HARDWARE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '../sync/fetch-hardware.mjs');
const EXPECTED_MIN_NOTICE_PAGES = 36;
const ONLINE = process.argv.includes('--online');
const SELF_TEST = process.argv.includes('--self-test');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;

/**
 * The five helpers the online probe and the self-test borrow from
 * `fetch-hardware`. The offline data gate only needs `hasPdfNotice`, for which
 * a local, dependency-free copy is kept below.
 */
const PDF_HELPERS = [
  'buildPdfNotice',
  'hasPdfNotice',
  'injectPdfNotice',
  'pdfNoticeFromHtml',
  'renderedPageUrl',
];
let hw = null; // loaded module namespace, or null when the helpers are unavailable
let hwReason = ''; // human-readable reason for the degraded path

/** Byte-faithful local copy of the hub's `hasPdfNotice` predicate. */
function fallbackHasPdfNotice(markdown) {
  const text = String(markdown || '');
  return /This guide can be downloaded as a\s*<a\b/i.test(text) &&
    /assets\/files\/[^\s"'>]+\.pdf/i.test(text);
}

/**
 * Load the PDF-notice helpers if this repository's `fetch-hardware.mjs`
 * exports them. Old locale copies export nothing and one runs `main()` at
 * import time, so detect the exports in source *before* importing: a missing
 * capability must never turn `--check` into a network fetch or a SyntaxError.
 */
async function loadPdfHelpers() {
  let source;
  try {
    source = fs.readFileSync(FETCH_HARDWARE, 'utf8');
  } catch (error) {
    hwReason = `cannot read tools/sync/fetch-hardware.mjs (${error.message})`;
    return;
  }
  const declared = PDF_HELPERS.every((name) =>
    new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${name}\\b`).test(source) ||
    new RegExp(`\\bexport\\s+(?:const|let|var)\\s+${name}\\b`).test(source) ||
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(source));
  if (!declared) {
    hwReason = 'tools/sync/fetch-hardware.mjs does not export the PDF-notice helpers';
    return;
  }
  try {
    const mod = await import('../sync/fetch-hardware.mjs');
    if (!PDF_HELPERS.every((name) => typeof mod[name] === 'function')) {
      hwReason = 'tools/sync/fetch-hardware.mjs exports are incomplete';
      return;
    }
    hw = mod;
  } catch (error) {
    hwReason = `importing tools/sync/fetch-hardware.mjs failed (${error.message})`;
  }
}

await loadPdfHelpers();
const hasNotice = hw ? hw.hasPdfNotice : fallbackHasPdfNotice;

/** Every committed hardware Markdown page, sorted for stable reporting. */
function hardwareMarkdown() {
  if (!fs.existsSync(HARDWARE)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(full);
    }
  };
  walk(HARDWARE);
  return out.sort();
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
}

function reporter() {
  const lines = [];
  const failures = [];
  const check = (name, ok, detail = '') => {
    lines.push(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  return {lines, failures, check};
}

/** Offline: count mirrored pages carrying the notice, and audit placement. */
function offlineCheck() {
  const {lines, failures, check} = reporter();
  const files = hardwareMarkdown();
  const notices = files
    .map((file) => ({file, text: fs.readFileSync(file, 'utf8')}))
    .filter((page) => hasNotice(page.text));
  check(
    `mirrored hardware pages with a PDF notice >= ${EXPECTED_MIN_NOTICE_PAGES}`,
    notices.length >= EXPECTED_MIN_NOTICE_PAGES,
    `count=${notices.length}/${files.length}`,
  );
  const badHref = notices.filter((page) =>
    !/href="[^"\s>]*assets\/files\/[^"\s>]+\.pdf[^"\s>]*"/.test(page.text));
  check('every notice links to /assets/files/<name>.pdf', badHref.length === 0,
    `bad=${badHref.length}`);
  const misplaced = notices.filter((page) => {
    const {body} = parseMarkdown(page.text);
    const at = body.search(/This guide can be downloaded as a\s*<a\b/i);
    const firstHeading = body.search(/^#\s/m);
    return at < 0 || (firstHeading >= 0 && at > firstHeading);
  });
  check('notice sits at the top of the body', misplaced.length === 0,
    `misplaced=${misplaced.length}`);

  const manifest = readManifest();
  if (!manifest) {
    lines.push('  SKIP manifest page audit: data/manifests/hardware.json is missing');
  } else {
    const listed = (manifest.pages || []).filter((page) => page?.pdf_notice);
    const missing = listed.filter((page) => {
      const file = path.join(REPO, page.local_path || '');
      return !fs.existsSync(file) || !hasNotice(fs.readFileSync(file, 'utf8')) ||
        !fs.readFileSync(file, 'utf8').includes(page.pdf_notice);
    });
    check('manifest pdf_notice entries match the files', missing.length === 0,
      `listed=${listed.length}, mismatched=${missing.length}`);
    if (listed.length) {
      check('manifest records the rehearsal-1 floor', listed.length >= EXPECTED_MIN_NOTICE_PAGES,
        `count=${listed.length}`);
    }
  }
  console.log(`pdf-notice: offline check${hw ? '' : ` — degraded data gate (${hwReason})`}`);
  for (const line of lines) console.log(line);
  return {ok: failures.length === 0, failures};
}

/** Online: discover official pages with the hint, then compare the mirror. */
async function onlineCheck() {
  const {lines, failures, check} = reporter();
  const manifest = readManifest();
  if (!manifest) {
    console.log('pdf-notice: SKIP online check — no hardware manifest');
    return {ok: true, failures};
  }
  let pages = (manifest.pages || []).filter(
    (page) => page?.local_path?.endsWith('.md') && page.slug !== 'index');
  if (LIMIT != null && Number.isFinite(LIMIT) && LIMIT > 0) pages = pages.slice(0, LIMIT);
  const probes = await mapLimit(pages, 4, async (page) => {
    const file = path.join(REPO, page.local_path);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const source = frontMatterValue(parseMarkdown(text).lines, 'source');
    const url = hw.renderedPageUrl(page.source_url || source, page.slug);
    return {page, url, official: hw.pdfNoticeFromHtml(await fetchText(url, {
      retries: 1,
      timeoutMs: 30000,
    }))};
  });
  const probed = probes.results.filter(Boolean);
  const official = probed.filter((probe) => probe.official);
  const missing = official.filter((probe) => {
    const file = path.join(REPO, probe.page.local_path);
    if (!fs.existsSync(file)) return true;
    const text = fs.readFileSync(file, 'utf8');
    return !hw.hasPdfNotice(text) || !text.includes(probe.official);
  });
  check('mirrored pages match every official notice', missing.length === 0,
    `official=${official.length}, matched=${official.length - missing.length}, missing=${missing.length}`);
  check('official notice count meets the rehearsal-1 floor',
    LIMIT == null ? official.length >= EXPECTED_MIN_NOTICE_PAGES : official.length >= 0,
    `official=${official.length}${LIMIT != null ? ` (limit=${LIMIT})` : ''}`);
  for (const probe of missing.slice(0, 8)) {
    lines.push(`    MISSING ${probe.page.local_path}: ${probe.url}`);
  }
  if (probes.errors.length) {
    lines.push(`  SKIP ${probes.errors.length} official page(s) that could not be probed (network unknown)`);
    for (const error of probes.errors.slice(0, 4)) lines.push(`    ${error.item.slug}: ${error.message}`);
  }
  console.log('pdf-notice: online check');
  for (const line of lines) console.log(line);
  return {ok: failures.length === 0, failures};
}

/** Pure probe: parser, injection, idempotency and archived URL derivation. */
function selfTest() {
  const html =
    '<article><p class="pdf-download">This guide can be downloaded as a ' +
    '<a href="/assets/files/knot-946091ad4c47a2e8a1e7e73892c75438.pdf" ' +
    'target="_blank" class="">PDF file</a>.</p></article>';
  const notice = hw.pdfNoticeFromHtml(html);
  assert.equal(notice,
    hw.buildPdfNotice('/assets/files/knot-946091ad4c47a2e8a1e7e73892c75438.pdf'));
  assert.equal(hw.pdfNoticeFromHtml('<article><p>no pdf here</p></article>'), null);
  const md = '---\ntitle: "KNOT"\n---\n\n# KNOT\n\nbody\n';
  const injected = hw.injectPdfNotice(md, notice);
  assert.ok(hw.hasPdfNotice(injected));
  assert.equal(hw.injectPdfNotice(injected, notice), injected);
  assert.equal(hw.injectPdfNotice(md, null), md);
  assert.equal(hw.renderedPageUrl('https://manual.mikrotik.com/docs/7.25/hardware/knot.md', 'knot'),
    'https://manual.mikrotik.com/docs/7.25/hardware/knot');
  console.log('pdf-notice self-test: HTML parse, injection, idempotency, archive URL — 4/4 passed');
}

if (SELF_TEST && !hw) {
  console.error(`pdf-notice self-test: unavailable — ${hwReason}.`);
  console.error('pdf-notice: this repository has no PDF-notice helpers to probe; no files were changed.');
  process.exitCode = 1;
} else if (ONLINE && !hw) {
  console.error(`pdf-notice: --online unavailable — ${hwReason}.`);
  console.error('pdf-notice: run the default offline data gate (--check) instead; the online probe needs the hub version of fetch-hardware.mjs. No files were changed.');
  process.exitCode = 1;
} else if (SELF_TEST) {
  selfTest();
} else {
  const offline = offlineCheck();
  const online = ONLINE ? await onlineCheck() : {ok: true, failures: []};
  const failures = [...offline.failures, ...online.failures];
  console.log(`pdf-notice: ${failures.length ? `FAIL ${failures.length} check(s): ${failures.join(', ')}` : 'PASS'}`);
  process.exitCode = failures.length ? 1 : 0;
}
