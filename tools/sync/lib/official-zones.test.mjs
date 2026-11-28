#!/usr/bin/env node
/**
 * node --test tools/sync/lib/official-zones.test.mjs
 *
 * Regression assertions for the "official new content cannot be discovered"
 * fix: (1) an unregistered quick guide is classified, never thrown away, and
 * (2) a slug-set change in ANY of hardware / blog / changelog makes the probe
 * report `changed` (exit 10). All fixtures are inline; no network, no .env.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHardwareEntry,
  parseHardwareEntries,
  parseBlogSlugs,
  parseChangelogPage,
  hashSlugs,
  zoneDiff,
  probeDecision,
  fetchOfficialZoneIndexes,
  HARDWARE_CATEGORY_KEYS,
  QUICK_GUIDE_OVERRIDES,
  parseHardwareStructure,
  structureDiff,
  hardwareStructureDiff,
  INVENTORY_URL,
  BLOG_INDEX_URL,
  CHANGELOG_INDEX_URL,
} from './official-zones.mjs';
import {stripOfficialLead} from '../fetch-hardware.mjs';
import {frontMatterValue} from './render-page.mjs';

const validCategories = new Set(Object.values(HARDWARE_CATEGORY_KEYS));

test('quick guides get their own category, never a product bucket', () => {
  const fresh = {
    slug: 'quick-guide-brand-new-model-v9',
    title: 'Quick Guide - Brand New Model v9',
    description: 'This Quick Guide covers the model: RB5009UG+S+IN.',
    category_label: 'Quick Guides',
  };
  const result = classifyHardwareEntry(fresh);
  assert.equal(result.category, 'quick-guides');
  assert.equal(result.category_source, 'quick-guide');
  assert.ok(validCategories.has(result.category));

  // The slug prefix alone is enough, even if the heading is missing or wrong.
  const bySlug = classifyHardwareEntry({slug: 'quick-guide-zzz', category_label: 'Accessories'});
  assert.equal(bySlug.category, 'quick-guides');
  assert.equal(bySlug.category_source, 'quick-guide');
  const safety = classifyHardwareEntry({slug: 'safety-regulatory-information-chateau'});
  assert.equal(safety.category, 'quick-guides');
  assert.equal(safety.category_source, 'quick-guide');
});

test('historic overrides apply only to non-guide entries; headings stay stable', () => {
  for (const [slug, category] of Object.entries(QUICK_GUIDE_OVERRIDES)) {
    const result = classifyHardwareEntry({slug, category_label: 'Quick Guides'});
    if (/^(quick-guide-|safety-regulatory-information-)/.test(slug)) {
      assert.equal(result.category, 'quick-guides');
      assert.equal(result.category_source, 'quick-guide');
    } else {
      const nonGuide = classifyHardwareEntry({slug, category_label: 'LTE products'});
      assert.equal(nonGuide.category, category);
      assert.equal(nonGuide.category_source, 'override');
    }
  }
  assert.equal(
    classifyHardwareEntry({slug: 'anything', category_label: 'Ethernet routers / Sub'}).category,
    'ethernet-routers',
  );
});

test('parseHardwareEntries classifies official llms.txt entries including new guides', () => {
  const llms = [
    'Index of the RouterOS 7.26 manual',
    '## Hardware Guides',
    '### Quick Guides',
    '- [Quick Guide - 5GHz RouterBOARD ax series](https://manual.mikrotik.com/hardware/quick-guide-5ghz-routerboard-ax-series.md): model L11UG-5HaxD.',
    '- [Quick Guide G3](https://manual.mikrotik.com/hardware/quick-guide-g3.md): Models: RBLDF-5nD.',
    '- [Quick Guide - ATL LTE18 kit](https://manual.mikrotik.com/hardware/quick-guide-atl-lte18-kit.md): Models: ATLGM&EG18-EA.',
    '### Accessories',
    '- [Something](https://manual.mikrotik.com/hardware/accessory-x.md): text.',
    '## Additional documentation',
    '- [Other](https://manual.mikrotik.com/docs/other.md): text.',
  ].join('\n');
  const entries = parseHardwareEntries(llms);
  assert.equal(entries.length, 4);
  for (const entry of entries.slice(0, 3)) {
    assert.equal(entry.category, 'quick-guides');
    assert.equal(entry.category_source, 'quick-guide');
  }
  assert.equal(entries[3].category, 'accessories');
  assert.equal(entries[3].category_source, 'heading');
});

test('slug-set hash is order independent and detects a set change', () => {
  assert.equal(hashSlugs(['b', 'a']), hashSlugs(['a', 'b']));
  assert.notEqual(hashSlugs(['a', 'b']), hashSlugs(['a', 'c']));
  const diff = zoneDiff(['a', 'b', 'new'], ['b', 'gone']);
  assert.deepEqual(diff.added, ['a', 'new']);
  assert.deepEqual(diff.missing, ['gone']);
  assert.equal(diff.changed, true);
  assert.equal(zoneDiff(['a'], ['a']).changed, false);
});

function baseline() {
  return {
    hardware: {slugs: ['hw-a', 'hw-b'], latest_slug: null},
    blog: {slugs: ['news1'], latest_slug: null},
    changelog: {slugs: ['changelog-2026-11-17'], latest_slug: 'changelog-2026-11-17'},
  };
}
function official() {
  return {
    hardware: ['hw-a', 'hw-b', 'quick-guide-brand-new'],
    blog: ['news1'],
    changelog: ['changelog-2026-11-17'],
  };
}

test('probe detects a hardware-only change (new quick guide)', () => {
  const decision = probeDecision(official(), baseline());
  assert.equal(decision.changed, true);
  assert.equal(decision.zones.hardware.status, 'changed');
  assert.deepEqual(decision.zones.hardware.added, ['quick-guide-brand-new']);
  assert.equal(decision.zones.blog.status, 'unchanged');
  assert.equal(decision.zones.changelog.status, 'unchanged');
});

test('probe detects a blog-only and a changelog-only change', () => {
  const blogOfficial = {...official(), blog: ['news1', 'news2']};
  assert.equal(probeDecision(blogOfficial, baseline()).zones.blog.status, 'changed');
  const logOfficial = {
    ...official(),
    changelog: ['changelog-2026-11-17', 'changelog-2026-11-19'],
  };
  const logDecision = probeDecision(logOfficial, baseline());
  assert.equal(logDecision.zones.changelog.status, 'changed');
  assert.equal(logDecision.changed, true);
  assert.match(
    logDecision.reasons.join(' '),
    /changelog freshness: local changelog-2026-11-17 < official changelog-2026-11-19/,
  );
});

test('probe stays unchanged when all three slug sets match', () => {
  const same = {
    hardware: ['hw-a', 'hw-b'],
    blog: ['news1'],
    changelog: ['changelog-2026-11-17'],
  };
  const decision = probeDecision(same, baseline());
  assert.equal(decision.changed, false);
  assert.deepEqual(decision.reasons, []);
});

test('probe reports a missing local baseline explicitly', () => {
  const decision = probeDecision(official(), {hardware: {slugs: []}, blog: null, changelog: null});
  assert.equal(decision.changed, true);
  assert.equal(decision.zones.blog.status, 'baseline-missing');
  assert.ok(decision.reasons.some((reason) => reason.includes('no local manifest')));
});

test('index-only fetching parses all three zones, including changelog pagination', async () => {
  const blogHtml = '<a href="/blog/news2">b</a><a href="/blog/news1">a</a>';
  const changelogPage1 = [
    '<a href="/changelog/changelog-2026-11-19">new</a>',
    '<a class="pagination-nav__link--next" href="/changelog/page/2">Older entries</a>',
  ].join('');
  const changelogPage2 = '<a href="/changelog/changelog-2026-11-17">old</a>';
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url === INVENTORY_URL) {
      return 'Index of the RouterOS 7.26 manual\n## Hardware Guides\n### Quick Guides\n' +
        '- [Quick Guide - New](https://manual.mikrotik.com/hardware/quick-guide-new.md): model X.\n' +
        '## Additional documentation\n';
    }
    if (url === BLOG_INDEX_URL) return blogHtml;
    if (url === CHANGELOG_INDEX_URL) return changelogPage1;
    if (url === 'https://manual.mikrotik.com/changelog/page/2') return changelogPage2;
    throw new Error(`unexpected URL ${url}`);
  };
  const result = await fetchOfficialZoneIndexes({fetcher});
  assert.deepEqual(result.zones.hardware, ['quick-guide-new']);
  assert.deepEqual(result.zones.blog.sort(), ['news1', 'news2']);
  assert.deepEqual(result.zones.changelog.sort(), ['changelog-2026-11-17', 'changelog-2026-11-19']);
  assert.equal(result.pagesVisited, 2);
  assert.equal(calls.length, 4, 'only four index reads; no article bodies');
  assert.deepEqual(parseChangelogPage(changelogPage2).older, null);
  assert.equal(parseBlogSlugs(blogHtml).length, 2);
});

test('fetch-hardware wrapper also accepts an unregistered quick guide', async () => {
  const {localCategory} = await import('../fetch-hardware.mjs');
  assert.equal(typeof localCategory, 'function');
  assert.doesNotThrow(() => localCategory('Quick Guides', 'quick-guide-never-seen-before'));
  const category = localCategory('Quick Guides', 'quick-guide-never-seen-before');
  assert.equal(category, 'quick-guides');
  assert.ok(validCategories.has(category));
});

const CATEGORY_LABELS = [
  'Quick Guides', '60 GHz products', 'Accessories', 'Antennas',
  'Data over Powerlines', 'Ethernet routers', 'Indoor wireless', 'Interfaces',
  'IoT products', 'LTE products', 'RouterBOARD', 'Switches', 'Wireless systems',
];

function hardwareHtml({
  categories = CATEGORY_LABELS,
  paragraphs = ['Hardware manuals for MikroTik products.', 'Browse a product category from the sidebar to find its manual.'],
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

test('structureDiff catches all three screenshot-proven misalignments', () => {
  const official = parseHardwareStructure(hardwareHtml());
  // The old mirror: 12 categories, duplicated `> lead` paragraph, quoted
  // breadcrumb and a Next link that skips every quick guide.
  const oldMirror = parseHardwareStructure(hardwareHtml({
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
  assert.equal(diff.changed, true);
  assert.deepEqual(
    diff.checks.filter((check) => check.matched === false).map((check) => check.id),
    ['categories', 'paragraphs', 'breadcrumb', 'pagination'],
  );
  assert.match(diff.reasons.join(' '), /categories/);
  assert.match(diff.reasons.join(' '), /paragraphs/);
  assert.match(diff.reasons.join(' '), /breadcrumb/);
  assert.match(diff.reasons.join(' '), /pagination/);

  // A fixed mirror (same structure, different deployment base path) is equal.
  const fixed = parseHardwareStructure(hardwareHtml({prefix: '/mikrotik_manual_i18n/hardware/'}));
  assert.equal(structureDiff(official, fixed).changed, false);
});

test('hardwareStructureDiff reports a missing local page instead of assuming equal', () => {
  const official = {landing: parseHardwareStructure(hardwareHtml())};
  const diff = hardwareStructureDiff(official, {});
  assert.equal(diff.changed, true);
  assert.match(diff.reasons[0], /landing: structure.landing: local baseline missing/);
});

test('stripOfficialLead removes the duplicate landing lead, keeping one paragraph', () => {
  const officialMd = [
    '# Hardware Guides',
    '',
    '> Hardware manuals for MikroTik products — covering ports, slots, buttons.',
    '',
    'Hardware manuals for MikroTik products — covering ports, slots, buttons.',
    '',
    'Browse a product category from the sidebar to find its manual.',
  ].join('\n');
  const stripped = stripOfficialLead(officialMd);
  assert.equal(stripped.includes('> '), false);
  const paragraphs = stripped.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  assert.equal(paragraphs[0].startsWith('#'), true);
  assert.equal(paragraphs.length, 3); // heading + two real paragraphs
  assert.equal(paragraphs.filter((text) => text.startsWith('Hardware manuals')).length, 1);

  // Landing-only body: exactly one paragraph and no blockquote after the fix.
  const landing = stripOfficialLead('> lead\n\none real paragraph\n');
  assert.equal(landing.includes('> '), false);
  assert.equal(landing.split(/\n\s*\n/).filter((block) => block.trim()).length, 1);
});

test('frontMatterValue unwraps escaped YAML titles instead of re-quoting them', () => {
  assert.equal(frontMatterValue(['title: "Hardware Guides"'], 'title'), 'Hardware Guides');
  assert.equal(frontMatterValue(['title: "\\"Hardware Guides\\""'], 'title'), 'Hardware Guides');
  assert.equal(frontMatterValue(["title: 'Hardware Guides'"], 'title'), 'Hardware Guides');
});
