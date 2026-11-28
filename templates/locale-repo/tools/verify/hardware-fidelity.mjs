#!/usr/bin/env node
/**
 * `verify:hardware-fidelity` — offline structural fidelity gate for Hardware.
 *
 * The slug-set probe cannot see three failures that the user screenshots showed:
 * Quick Guides folded into four product categories, the `> lead` paragraph
 * rendered twice, and a quoted breadcrumb / wrong Next link. This gate compares
 * the committed source of truth (sidebars-hardware.ts, sidebar-labels.yml,
 * hardware manifest, hardware/index.md) and, when present, the rendered build/
 * HTML. `--online` additionally fetches the official page structure.
 *
 *   node tools/verify/hardware-fidelity.mjs              # offline repo checks
 *   node tools/verify/hardware-fidelity.mjs --online     # + official fetch
 *   node tools/verify/hardware-fidelity.mjs --self-test  # pure-function probe
 *
 * Exit 0 every executed check passed, 1 at least one failed. `--self-test`
 * needs no repository data and proves the structure probe detects the old
 * 12-category / quoted-crumb / duplicated-lead / wrong-Next state.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {
  fetchHardwareStructures,
  formatStructureProbe,
  hardwareStructureDiff,
  localHardwareStructure,
  parseHardwareStructure,
  structureDiff,
} from '../sync/lib/official-zones.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ONLINE = process.argv.includes('--online');
const SELF_TEST = process.argv.includes('--self-test');

const CATEGORY_LABELS = [
  'Quick Guides', '60 GHz products', 'Accessories', 'Antennas',
  'Data over Powerlines', 'Ethernet routers', 'Indoor wireless', 'Interfaces',
  'IoT products', 'LTE products', 'RouterBOARD', 'Switches', 'Wireless systems',
];
const QG_SLUG_RE = /^(?:quick-guide-|safety-regulatory-information-)/;

function fixtureHtml({
  categories = CATEGORY_LABELS,
  paragraphs = [
    'Hardware manuals for MikroTik products.',
    'Browse a product category from the sidebar to find its manual.',
  ],
  crumb = 'Hardware Guides',
  next = {label: 'Quick Guide - 5GHz RouterBOARD ax series', slug: 'quick-guide-5ghz-routerboard-ax-series'},
  prefix = '/hardware/',
} = {}) {
  const nav = categories.map((label, i) => `<a class="menu__link--sublist" href="${prefix}x${i}">${label}</a>`).join('');
  const body = paragraphs.map((text) => `<p>${text}</p>`).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{position: 1, name: crumb, item: 'https://manual.mikrotik.com/hardware/'}],
  });
  const pagination = next
    ? `<a class="pagination-nav__link pagination-nav__link--next" href="${prefix}${next.slug}">` +
      `<span class="pagination-nav__sublabel">Next</span><span class="pagination-nav__label">${next.label}</span></a>`
    : '';
  return `<html><body><nav>${nav}</nav><script type="application/ld+json">${jsonLd}</script>` +
    `<article>${body}</article>${pagination}</body></html>`;
}

/** Pure-function probe: no files, no network, no thresholds to tune. */
function selfTest() {
  const official = parseHardwareStructure(fixtureHtml());
  const oldMirror = parseHardwareStructure(fixtureHtml({
    categories: CATEGORY_LABELS.slice(1),
    paragraphs: [
      'Hardware manuals for MikroTik products.',
      'Hardware manuals for MikroTik products.',
      'Browse a product category from the sidebar to find its manual.',
    ],
    crumb: '"Hardware Guides"',
    next: {label: 'Cube 60G ac', slug: 'cube-60g-ac'},
    prefix: '/mikrotik_manual_i18n/hardware/',
  }));
  assert.equal(official.categories.length, 13);
  assert.equal(oldMirror.categories.length, 12);
  const diff = structureDiff(official, oldMirror);
  assert.deepEqual(
    diff.checks.filter((check) => check.matched === false).map((check) => check.id),
    ['categories', 'paragraphs', 'breadcrumb', 'pagination'],
  );
  assert.equal(diff.changed, true);
  const aligned = parseHardwareStructure(fixtureHtml({prefix: '/mikrotik_manual_i18n/hardware/'}));
  assert.equal(structureDiff(official, aligned).changed, false);
  // The landing title must be judged by its parsed YAML value, not by the
  // presence of quote characters: the generator writes it with JSON.stringify,
  // so `title: "Hardware Guides"` is a correct YAML scalar. A value that really
  // contains quotes, or any different value, must still fail.
  const titleFixture = (value) => `---\ntitle: ${value}\nsource: https://manual.mikrotik.com/hardware/\n---\n\n# Hardware Guides\n`;
  assert.equal(parseLandingTitle(titleFixture('Hardware Guides')), 'Hardware Guides');
  assert.equal(parseLandingTitle(titleFixture('"Hardware Guides"')), 'Hardware Guides');
  assert.notEqual(parseLandingTitle(titleFixture(`'"Hardware Guides"'`)), 'Hardware Guides');
  assert.notEqual(parseLandingTitle(titleFixture('"Wrong Guides"')), 'Hardware Guides');
  console.log('hardware-fidelity self-test: 13 vs 12 categories detected; quoted crumb detected;');
  console.log('  duplicated lead paragraph detected; wrong Next link detected; aligned mirror unchanged.');
  console.log('  landing title: YAML-quoted correct value accepted; literal quotes / wrong value rejected.');
  console.log('self-test: 4/4 dimensions + 4 title fixtures, 0 unexpected results');
}

function parseSidebarGroups(repo) {
  const file = path.join(repo, 'sidebars-hardware.ts');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const groups = [];
  const re = /\{\s*type:\s*['"]category['"],\s*label:\s*(['"])(.*?)\1,\s*items:\s*\[([^\]]*)\]/g;
  for (const match of text.matchAll(re)) {
    groups.push({
      label: match[2],
      items: [...match[3].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]).filter(Boolean),
    });
  }
  return groups;
}

/**
 * Parse the landing front matter as YAML and return the `title` value.
 *
 * The generator serialises front-matter values with JSON.stringify, so a
 * correct title is written as the YAML double-quoted scalar
 * `title: "Hardware Guides"`. Judging the raw line by the presence of `"`
 * rejected valid YAML; comparing the parsed value checks the semantics the
 * rendered breadcrumb actually uses and still rejects a value that literally
 * contains quotes or a different string.
 */
function parseLandingTitle(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text || '');
  if (!match) return undefined;
  try {
    const frontMatter = YAML.parse(match[1]);
    return frontMatter && typeof frontMatter === 'object' ? frontMatter.title : undefined;
  } catch {
    return undefined;
  }
}

function readLanding(repo) {
  const file = path.join(repo, 'hardware/index.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  return {
    title: parseLandingTitle(text),
    body: match ? text.slice(match[0].length) : text,
  };
}

async function main() {
  if (SELF_TEST) {
    selfTest();
    return;
  }
  const lines = [];
  const failures = [];
  const check = (name, ok, detail = '') => {
    lines.push(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  const structure = localHardwareStructure({repo: REPO});
  const groups = parseSidebarGroups(REPO);
  const categories = structure.landing?.categories || [];

  check('sidebar has 13 categories', categories.length === 13, `count=${categories.length}`);
  check('Quick Guides is first', categories[0] === 'Quick Guides', `first=${categories[0] || '(none)'}`);
  const qgGroup = groups.find((group) => group.label === 'Quick Guides');
  check('sidebars-hardware.ts has 13 quick-guide items', qgGroup?.items.length === 13, `count=${qgGroup?.items.length ?? 0}`);
  check(
    'quick-guide items use the quick-guides/ prefix',
    Boolean(qgGroup?.items.every((item) => item.startsWith('quick-guides/'))),
    `items=${qgGroup?.items.length ?? 0}`,
  );
  const stray = groups
    .filter((group) => group.label !== 'Quick Guides')
    .flatMap((group) => group.items.filter((item) => QG_SLUG_RE.test(item.split('/').pop() || '')));
  check('no quick guide left in product categories', stray.length === 0, `stray=${stray.length}`);

  const policyFile = path.join(REPO, 'config/sidebar-labels.yml');
  const policy = fs.existsSync(policyFile) ? YAML.parse(fs.readFileSync(policyFile, 'utf8')) : null;
  const qgLabel = policy?.hardware?.categories?.['Quick Guides'];
  check('sidebar-labels.yml has the Quick Guides label', Boolean(qgLabel), `label=${qgLabel || '(missing)'}`);

  const manifestFile = path.join(REPO, 'data/manifests/hardware.json');
  const manifest = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    : null;
  const manifestCategories = manifest?.categories || [];
  check('manifest has 13 categories', manifestCategories.length === 13, `count=${manifestCategories.length}`);
  check(
    'manifest category plan matches the official nav order',
    manifestCategories[0]?.key === 'quick-guides' &&
      manifestCategories.every((category, index) => category.position === index + 2),
    `first=${manifestCategories[0]?.key || '(none)'}`,
  );
  const guidePages = (manifest?.pages || []).filter((page) =>
    QG_SLUG_RE.test(String(page.slug || '').replace(/^\//, '')),
  );
  check(
    'manifest quick guides are in hardware/quick-guides/',
    guidePages.length === 13 && guidePages.every((page) => String(page.local_path || '').startsWith('hardware/quick-guides/')),
    `guide pages=${guidePages.length}, in new folder=${guidePages.filter((page) => String(page.local_path || '').startsWith('hardware/quick-guides/')).length}`,
  );

  const landing = readLanding(REPO);
  // Semantic check: YAML-parsed title must be exactly the official breadcrumb
  // label. JSON.stringify quoting in the front matter is valid YAML, while a
  // literally quoted value or a wrong label is still rejected.
  check(
    'landing title parses to "Hardware Guides"',
    landing?.title === 'Hardware Guides',
    `title=${JSON.stringify(landing?.title ?? '(missing)')}`,
  );
  const body = landing?.body || '';
  const quoteCount = (body.match(/> /g) || []).length;
  check('landing body has no > lead blockquote', quoteCount === 0, `'> ' count=${quoteCount}`);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !/^#/.test(block));
  // Count the lead text in both the quote and the body: before the fix the same
  // sentence is rendered twice (once as blockquote, once as body paragraph).
  const leadOccurrences = (body.match(/^>?\s*Hardware manuals/gm) || []).length;
  check('landing lead text appears once', leadOccurrences === 1, `count=${leadOccurrences}`);
  check(
    'landing body paragraph count matches official (2)',
    paragraphs.length === 2,
    `paragraphs=${paragraphs.length}`,
  );

  const builtLanding = path.join(REPO, 'build/hardware/index.html');
  if (fs.existsSync(builtLanding)) {
    const built = parseHardwareStructure(fs.readFileSync(builtLanding, 'utf8'));
    const diff = structureDiff(structure.landing, built);
    check('build HTML matches the committed source structure', !diff.changed, diff.reasons.join(' | ').slice(0, 400));
  } else {
    lines.push('  SKIP build HTML: build/hardware/index.html not present');
  }

  if (ONLINE) {
    const official = await fetchHardwareStructures();
    const local = fs.existsSync(builtLanding)
      ? {
          landing: parseHardwareStructure(fs.readFileSync(builtLanding, 'utf8')),
          sample: localHardwareStructure({repo: REPO}).sample,
        }
      : localHardwareStructure({repo: REPO});
    const diff = hardwareStructureDiff(official, local);
    for (const line of formatStructureProbe(diff)) lines.push(line);
    check('official /hardware/ structure', !diff.changed, diff.reasons.join(' | ').slice(0, 400));
  }

  console.log('hardware-fidelity:');
  for (const line of lines) console.log(line);
  console.log(`hardware-fidelity: checks=${lines.filter((line) => /^  (PASS|FAIL)/.test(line)).length} failed=${failures.length}`);
  if (failures.length) {
    console.error(`hardware-fidelity: ${failures.join('; ')}`);
    process.exitCode = 1;
  }
}

await main();
