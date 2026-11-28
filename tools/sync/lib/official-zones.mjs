#!/usr/bin/env node
/**
 * Official three-zone index probe + hardware classifier (pure core).
 *
 * The docs corpus ETag answers "did the documentation change?" but the mirror
 * also publishes three zones that are NOT part of llms-full.txt: hardware,
 * blog and changelog. Their official inventories are cheap index reads:
 *
 *   hardware   https://manual.mikrotik.com/llms.txt  (## Hardware Guides)
 *   blog       https://manual.mikrotik.com/blog/     (newsNNN links)
 *   changelog  https://manual.mikrotik.com/changelog/ (+ "Older entries" pages)
 *
 * `fetchOfficialZoneIndexes` reads only those indexes (never a page body),
 * `zoneDiff` compares their slug sets with the committed zone manifests, and
 * `probeDecision` turns any difference into a `changed` probe result (exit 10).
 * Every core function is pure and injectable so the gate has a unit test.
 *
 * The same module owns hardware classification: `classifyHardwareEntry` folds
 * an llms.txt entry into one of the hub's 13 local categories. Quick Guides are
 * their own top-level category (the first one, in the official nav), so neither
 * a keyword rule nor a historic override can fold them back into a product
 * category. Unknown non-guide entries still get a keyword-based category or the
 * generic `accessories` bucket — they never throw.
 *
 * `structureDiff` upgrades the probe from "slug set unchanged" to a structural
 * comparison of the rendered `/hardware/` landing page and a sample Quick Guide:
 * category label sequence, body paragraphs, JSON-LD breadcrumb and pagination
 * next/prev (label + slug). A slug set can match perfectly while the sidebar,
 * breadcrumb or Next link is misaligned; that is exactly what this catches.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as cheerio from 'cheerio';

export const BASE_URL = 'https://manual.mikrotik.com';
export const INVENTORY_URL = `${BASE_URL}/llms.txt`;
export const BLOG_INDEX_URL = `${BASE_URL}/blog/`;
export const CHANGELOG_INDEX_URL = `${BASE_URL}/changelog/`;
export const USER_AGENT =
  'mikrotik-manual-mirror/1.0 (+https://github.com/newwlfz/mikrotik_manual_i18n)';

export const ZONES = ['hardware', 'blog', 'changelog'];
export const ZONE_MANIFESTS = {
  hardware: 'data/manifests/hardware.json',
  blog: 'data/manifests/blog.json',
  changelog: 'data/manifests/changelog.json',
};

export const OFFICIAL_VERSION_RE = /Index of the RouterOS (\d+(?:\.\d+)+) manual/;

/**
 * Cached observation of the official changelog index (read 2026-11-21), used by
 * the offline build-input freshness assertion when no refreshed cache file is
 * present. A newer `data/manifests/official-zones.json` written by
 * `report-update.mjs --zones --write` always takes precedence; `--online`
 * refreshes it from the live index. This is an observed index value, not a
 * pass/fail threshold to be tuned.
 */
export const OFFICIAL_CHANGELOG_SNAPSHOT = {
  captured_at: '2026-11-21T00:00:00Z',
  source: CHANGELOG_INDEX_URL,
  latest_slug: 'changelog-2026-11-19',
};

/** The hub's 13 hardware categories, in the official `/hardware/` nav order. */
export const HARDWARE_CATEGORY_KEYS = {
  // First in the official nav (/hardware/quick-guide-5ghz-routerboard-ax-series).
  // It is a category of its own: folding quick guides into product categories
  // removes 13 pages from the sidebar and changes the landing page's Next link.
  'Quick Guides': 'quick-guides',
  '60 GHz products': 'ghz-products',
  Accessories: 'accessories',
  Antennas: 'antennas',
  'Data over Powerlines': 'data-over-powerlines',
  'Ethernet routers': 'ethernet-routers',
  'Indoor wireless': 'indoor-wireless',
  Interfaces: 'interfaces',
  'IoT products': 'iot-products',
  'LTE products': 'lte-products',
  RouterBOARD: 'routerboard',
  Switches: 'switches',
  'Wireless systems': 'wireless-systems',
};

/**
 * Historic overrides for entries that used to be folded into product
 * categories. They only apply to *non*-guide entries now: a `quick-guide-*` /
 * `safety-regulatory-information-*` slug or a `Quick Guides` heading always
 * resolves to the dedicated `quick-guides` category first.
 */
export const QUICK_GUIDE_OVERRIDES = {
  'quick-guide-ccr2004-16g-2s-plus': 'ethernet-routers',
  'quick-guide-ccr2004-1g-12s-plus-2xs': 'ethernet-routers',
  'quick-guide-g3': 'wireless-systems',
  'safety-regulatory-information-chateau': 'lte-products',
  'first-steps-chateau-lte6': 'lte-products',
};

/**
 * Ordered keyword rules for unregistered quick guides (first match wins).
 * `scope: 'name'` rules look only at title+slug: an "Audience ... LTE6 kit"
 * description must not pull an indoor AP into the LTE category. `all` rules may
 * also use the llms.txt description when the model name is ambiguous.
 */
export const QUICK_GUIDE_RULES = [
  {category: 'lte-products', scope: 'name', re: /\b(lte|lte6|lte18|atlgm|eg18|chateau|4g)\b/i},
  {category: 'switches', scope: 'all', re: /\b(crs\d*|switch(es|ing)?|css\d*)\b/i},
  {category: 'ghz-products', scope: 'all', re: /\b(60\s?ghz)\b/i},
  {category: 'indoor-wireless', scope: 'name', re: /\b(indoor|cap|audience|wap|wi-fi|wifi|access point|ap)\b/i},
  {category: 'wireless-systems', scope: 'all', re: /\b(5ghz|2\.4ghz|ax|ac|nstream|lhg|sxt|dish|antenna|outdoor|wireless)\b/i},
  {category: 'ethernet-routers', scope: 'all', re: /\b(ccr\d*|routerboard|router|rb\d+)\b/i},
  {category: 'lte-products', scope: 'all', re: /\b(lte|lte6|lte18|atlgm|eg18|chateau|4g)\b/i},
];

/** Slug prefixes that mark a page as a Quick Guide even without a heading. */
export const QUICK_GUIDE_SLUG_RE = /^(?:quick-guide-|safety-regulatory-information-)/i;

/**
 * Classify one llms.txt hardware entry. Never throws on an unknown slug:
 * quick guide -> override -> known `###` heading -> keyword inference ->
 * generic bucket.
 *
 * The quick-guide check comes first on purpose: the nine keyword-classified
 * and four override-classified guides used to be scattered over four product
 * categories, which made them invisible in the sidebar and gave the landing
 * page the wrong Next link.
 *
 * @returns {{category: string, category_source: 'quick-guide'|'override'|'heading'|'keyword'|'generic'}}
 */
export function classifyHardwareEntry(entry = {}, overrides = QUICK_GUIDE_OVERRIDES) {
  const slug = String(entry.slug || '');
  const heading = String(entry.category_label || '').split(' / ')[0].trim();
  if (heading === 'Quick Guides' || QUICK_GUIDE_SLUG_RE.test(slug)) {
    return {category: 'quick-guides', category_source: 'quick-guide'};
  }
  if (overrides[slug]) return {category: overrides[slug], category_source: 'override'};
  if (HARDWARE_CATEGORY_KEYS[heading]) {
    return {category: HARDWARE_CATEGORY_KEYS[heading], category_source: 'heading'};
  }
  const name = `${entry.title || ''} ${slug}`;
  const haystack = `${name} ${entry.description || ''}`;
  for (const rule of QUICK_GUIDE_RULES) {
    if (rule.re.test(rule.scope === 'name' ? name : haystack)) {
      return {category: rule.category, category_source: 'keyword'};
    }
  }
  return {category: 'accessories', category_source: 'generic'};
}

/**
 * Parse the `## Hardware Guides` inventory into classified entries.
 * Pure: no network, no filesystem, no count assertion (the fetch stage keeps
 * its own 250-page floor).
 */
export function parseHardwareEntries(llms) {
  const start = llms.indexOf('## Hardware Guides');
  if (start === -1) throw new Error('llms.txt has no ## Hardware Guides section');
  const rest = llms.slice(start + '## Hardware Guides'.length);
  const end = rest.search(/\n## /);
  const section = end === -1 ? rest : rest.slice(0, end);
  let heading = '';
  const entries = [];
  for (const line of section.split('\n')) {
    if (line.startsWith('### ')) heading = line.slice(4).trim();
    const match = /^- \[([^\]]+)\]\(https:\/\/manual\.mikrotik\.com\/hardware\/([^/)]+)\.md\)(?::\s*(.*))?$/.exec(line);
    if (!match) continue;
    const [, title, slug, description = ''] = match;
    entries.push({
      slug,
      title,
      description: description.trim(),
      category_label: heading,
      ...classifyHardwareEntry({slug, title, description, category_label: heading}),
    });
  }
  return entries;
}

export function officialVersion(llms) {
  const match = OFFICIAL_VERSION_RE.exec(llms || '');
  return match ? match[1] : null;
}

export function parseBlogSlugs(html) {
  const $ = cheerio.load(html);
  const slugs = $('a[href]')
    .map((_, element) => {
      const match = /^\/blog\/(news\d+)\/?$/.exec($(element).attr('href') || '');
      return match ? match[1] : null;
    })
    .get()
    .filter(Boolean);
  if (!slugs.length) throw new Error('/blog/ HTML has no newsNNN links');
  return [...new Set(slugs)];
}

/** One changelog index page: its slugs and the "Older entries" href, if any. */
export function parseChangelogPage(html) {
  const $ = cheerio.load(html);
  const slugs = [...new Set(
    $('a[href^="/changelog/changelog-"]')
      .map((_, element) => {
        const slug = String($(element).attr('href') || '').replace(/\/+$/, '').split('/').at(-1);
        return /^changelog-\d{4}-\d{2}-\d{2}$/.test(slug) ? slug : null;
      })
      .get()
      .filter(Boolean),
  )];
  const older = $('a.pagination-nav__link--next, a[href^="/changelog/page/"]')
    .filter((_, element) => /older|旧|下一/i.test($(element).text()))
    .first()
    .attr('href');
  return {slugs, older: older || null};
}

/** Stable order-independent digest of a slug set. */
export function hashSlugs(slugs) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([...new Set(slugs)].sort()))
    .digest('hex');
}

/** Added = official-only, missing = local-only. Both reasons require a sync. */
export function zoneDiff(officialSlugs = [], localSlugs = []) {
  const official = [...new Set(officialSlugs)].sort();
  const local = [...new Set(localSlugs)].sort();
  const added = official.filter((slug) => !local.includes(slug));
  const missing = local.filter((slug) => !official.includes(slug));
  return {
    official_hash: hashSlugs(official),
    local_hash: hashSlugs(local),
    official_count: official.length,
    local_count: local.length,
    added,
    missing,
    changed: added.length > 0 || missing.length > 0,
  };
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Baseline slug set from a committed zone manifest. Returns null when the
 * baseline is unavailable (probe cannot decide -> caller fails with code 2).
 */
export function localZoneSlugs(repo, zone) {
  const manifest = readJson(path.join(repo, ZONE_MANIFESTS[zone]));
  if (!manifest) return null;
  const slugs = (manifest.pages || [])
    .filter((page) => zone !== 'changelog' || !page.from_seed)
    .map((page) => String(page.slug || '').replace(/^\//, ''))
    .filter((slug) => slug && slug !== 'index');
  const sorted = [...new Set(slugs)].sort().reverse();
  return {
    slugs,
    latest_slug: manifest.latest_slug || sorted[0] || null,
    generated_at: manifest.generated_at || null,
  };
}

/**
 * Pure probe decision: any zone's slug-set hash mismatch is a `changed` result.
 * A null local baseline is explicit ("baseline-missing"), never silently equal.
 */
export function probeDecision(officialZones = {}, localZones = {}) {
  const zones = {};
  const reasons = [];
  for (const zone of ZONES) {
    const local = localZones[zone];
    const official = officialZones[zone] || [];
    if (!local) {
      zones[zone] = {status: 'baseline-missing', official_count: official.length, added: [], missing: []};
      reasons.push(`${zone}: no local manifest baseline`);
      continue;
    }
    const diff = zoneDiff(official, local.slugs || []);
    zones[zone] = {...diff, status: diff.changed ? 'changed' : 'unchanged'};
    if (diff.changed) {
      const parts = [];
      if (diff.added.length) parts.push(`+${diff.added.length} (${diff.added.slice(0, 4).join(', ')})`);
      if (diff.missing.length) parts.push(`-${diff.missing.length} (${diff.missing.slice(0, 4).join(', ')})`);
      reasons.push(`${zone}: ${parts.join(' ')}`);
    }
  }
  const officialChangelog = [...new Set(officialZones.changelog || [])].sort().reverse()[0] || null;
  const localChangelog = localZones.changelog?.latest_slug || null;
  if (officialChangelog && localChangelog && localChangelog < officialChangelog) {
    reasons.push(`changelog freshness: local ${localChangelog} < official ${officialChangelog}`);
  }
  return {
    changed: reasons.length > 0,
    zones,
    reasons,
    official_changelog_latest: officialChangelog,
    local_changelog_latest: localChangelog,
  };
}

/** Human-readable diff lines for `--probe` and `report-update --zones`. */
export function formatZoneProbe(decision) {
  const lines = [];
  for (const zone of ZONES) {
    const item = decision.zones[zone] || {};
    if (item.status === 'baseline-missing') {
      lines.push(`  ${zone.padEnd(9)} baseline-missing (official=${item.official_count})`);
      continue;
    }
    lines.push(
      `  ${zone.padEnd(9)} ${String(item.status).padEnd(9)} ` +
        `official=${item.official_count} local=${item.local_count} ` +
        `hash=${String(item.official_hash).slice(0, 12)}/${String(item.local_hash).slice(0, 12)}`,
    );
    for (const slug of item.added || []) lines.push(`    + ${slug}`);
    for (const slug of item.missing || []) lines.push(`    - ${slug}`);
  }
  if (decision.official_changelog_latest) {
    lines.push(
      `  changelog official_latest=${decision.official_changelog_latest} ` +
        `local_latest=${decision.local_changelog_latest || '(none)'}`,
    );
  }
  for (const reason of decision.reasons || []) lines.push(`  reason: ${reason}`);
  return lines;
}

/** Default transport: one bounded GET per index, no page bodies. */
export async function defaultFetcher(url, {timeoutMs = 60000} = {}) {
  const response = await fetch(url, {
    headers: {'user-agent': USER_AGENT},
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** Read the official inventory once; it carries both the version and hardware slugs. */
export async function fetchOfficialInventory({fetcher = defaultFetcher} = {}) {
  const text = await fetcher(INVENTORY_URL);
  const version = officialVersion(text);
  if (!version) throw new Error('cannot read the RouterOS version from /llms.txt');
  return {text, version};
}

/**
 * Fetch the three official index inventories. `inventoryText` lets the caller
 * reuse the llms.txt it already read for version discovery.
 */
export async function fetchOfficialZoneIndexes({fetcher = defaultFetcher, inventoryText = null, maxPages = 50} = {}) {
  const llms = inventoryText ?? (await fetcher(INVENTORY_URL));
  const hardware = parseHardwareEntries(llms).map((entry) => entry.slug);
  if (!hardware.length) throw new Error('llms.txt has no hardware guide links');
  const blog = parseBlogSlugs(await fetcher(BLOG_INDEX_URL));

  const changelog = new Set();
  const visited = new Set();
  let url = CHANGELOG_INDEX_URL;
  while (url && !visited.has(url) && visited.size < maxPages) {
    visited.add(url);
    const page = parseChangelogPage(await fetcher(url));
    for (const slug of page.slugs) changelog.add(slug);
    url = page.older ? new URL(page.older, BASE_URL).href : null;
  }
  if (!changelog.size) throw new Error('no changelog slugs discovered from rendered HTML');

  return {
    version: officialVersion(llms),
    zones: {hardware, blog, changelog: [...changelog]},
    pagesVisited: visited.size,
  };
}

/** Fetch just the newest changelog index page for the online freshness check. */
export async function fetchOfficialChangelogLatest({fetcher = defaultFetcher} = {}) {
  const {slugs} = parseChangelogPage(await fetcher(CHANGELOG_INDEX_URL));
  return {slug: slugs.sort().reverse()[0] || null, source: CHANGELOG_INDEX_URL};
}

/** Full probe: official indexes + local manifests -> decision. Writes nothing. */
export async function runZoneProbe({repo, fetcher = defaultFetcher, inventoryText = null} = {}) {
  const indexes = await fetchOfficialZoneIndexes({fetcher, inventoryText});
  const local = Object.fromEntries(ZONES.map((zone) => [zone, localZoneSlugs(repo, zone)]));
  return {...probeDecision(indexes.zones, local), version: indexes.version, pagesVisited: indexes.pagesVisited};
}

// ---------------------------------------------------------------------------
// Structure + body fidelity: slugs alone cannot prove alignment.
// ---------------------------------------------------------------------------

/** Landing page plus the first Quick Guide (the first item of the new sidebar). */
export const HARDWARE_STRUCTURE_PAGES = {
  landing: '/hardware/',
  sample: '/hardware/quick-guide-5ghz-routerboard-ax-series',
};

const STRUCTURE_DIMENSIONS = ['categories', 'paragraphs', 'breadcrumb', 'pagination'];

/** Strip host prefixes, markdown links and whitespace before comparing prose. */
export function normalizeStructureText(text) {
  return String(text ?? '')
    .replace(/https?:\/\/[^\s)'"<>]+/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[\s>]+|[\s>]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function structureDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Parse one rendered hardware page into the four structure dimensions.
 * Pure: HTML in, observations out; no network and no filesystem.
 */
export function parseHardwareStructure(html) {
  const $ = cheerio.load(String(html || ''));
  const categories = [...new Set(
    $('a.categoryLink_byQd, a.menu__link--sublist')
      .map((_, element) => {
        const href = String($(element).attr('href') || '');
        if (!/\/hardware\//.test(href)) return null;
        return normalizeStructureText($(element).text());
      })
      .get()
      .filter(Boolean),
  )];
  const paragraphs = $('article p')
    .map((_, element) => normalizeStructureText($(element).text()))
    .get()
    .filter(Boolean);
  const breadcrumb = [];
  for (const script of $('script[type="application/ld+json"]').get()) {
    let data;
    try {
      data = JSON.parse($(script).html() || '');
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      const lists = [];
      if (node?.['@type'] === 'BreadcrumbList') lists.push(node);
      if (Array.isArray(node?.['@graph'])) {
        lists.push(...node['@graph'].filter((entry) => entry?.['@type'] === 'BreadcrumbList'));
      }
      for (const list of lists) {
        for (const item of list.itemListElement || []) {
          const name = typeof item === 'string' ? item : item?.name || item?.item?.name || '';
          const clean = normalizeStructureText(name);
          if (clean) breadcrumb.push(clean);
        }
      }
    }
  }
  const pagination = {};
  for (const direction of ['prev', 'next']) {
    const link = $(`a.pagination-nav__link--${direction}`).first();
    if (!link.length) {
      pagination[direction] = null;
      continue;
    }
    const sublabel = normalizeStructureText(
      link.find('.pagination-nav__label, .pagination-nav__sublabel').last().text(),
    );
    const label = sublabel || normalizeStructureText(link.text()).replace(/^(Next|Previous|下一页|上一页)\s*/i, '');
    const href = String(link.attr('href') || '');
    const match = /\/hardware\/([^/?#]*)/.exec(href);
    pagination[direction] = {label, slug: match ? match[1].replace(/\/$/, '') : null};
  }
  return {categories, paragraphs, breadcrumb, pagination};
}

/**
 * Compare four dimensions. A dimension that is unavailable on either side stays
 * explicit (`unavailable`) instead of being silently treated as equal; any
 * observed mismatch sets `changed` (the probe turnstile to exit 10).
 */
export function structureDiff(official = {}, local = {}) {
  const checks = [];
  const reasons = [];
  const unavailable = [];
  for (const id of STRUCTURE_DIMENSIONS) {
    const observed = official[id];
    const committed = local[id];
    if (observed == null || committed == null) {
      unavailable.push(id);
      checks.push({id, status: 'unavailable'});
      continue;
    }
    const left = id === 'paragraphs'
      ? {count: observed.length, digest: structureDigest(observed)}
      : observed;
    const right = id === 'paragraphs'
      ? {count: committed.length, digest: structureDigest(committed)}
      : committed;
    const matched = JSON.stringify(left) === JSON.stringify(right);
    checks.push({id, matched, official: left, local: right});
    if (!matched) {
      reasons.push(`structure.${id}: official=${JSON.stringify(left)} local=${JSON.stringify(right)}`);
    }
  }
  return {changed: reasons.length > 0, checks, reasons, unavailable};
}

/** Compare the landing page and the sample page; every page diff is retained. */
export function hardwareStructureDiff(officialPages = {}, localPages = {}) {
  const pages = {};
  const reasons = [];
  for (const [name, official] of Object.entries(officialPages)) {
    const local = localPages[name];
    const diff = local
      ? structureDiff(official, local)
      : {
          changed: true,
          checks: [],
          unavailable: STRUCTURE_DIMENSIONS,
          reasons: [`structure.${name}: local baseline missing`],
        };
    pages[name] = diff;
    for (const reason of diff.reasons) reasons.push(`${name}: ${reason}`);
  }
  return {changed: reasons.length > 0, pages, reasons};
}

/** Human-readable structure lines for `--probe`. */
export function formatStructureProbe(diff) {
  const lines = [];
  for (const [name, page] of Object.entries(diff.pages || {})) {
    const checks = (page.checks || []).map((check) =>
      check.status === 'unavailable'
        ? `${check.id}=unavailable`
        : `${check.id}=${check.matched ? 'ok' : 'MISMATCH'}`,
    );
    lines.push(`  hardware.${name.padEnd(7)} ${checks.join(' ') || 'no checks'}`);
    for (const reason of page.reasons || []) lines.push(`    ${reason}`);
  }
  return lines;
}

/** Fetch the rendered official pages used by the structure probe. */
export async function fetchHardwareStructures({
  fetcher = defaultFetcher,
  pages = HARDWARE_STRUCTURE_PAGES,
} = {}) {
  const parsed = {};
  for (const [name, route] of Object.entries(pages)) {
    parsed[name] = parseHardwareStructure(await fetcher(new URL(route, BASE_URL).href));
  }
  return parsed;
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parseMarkdownLite(text) {
  const match = FRONT_MATTER_RE.exec(String(text || ''));
  if (!match) return {lines: [], body: String(text || '')};
  return {
    lines: match[1].split(/\r?\n/),
    body: String(text).slice(match[0].length).replace(/^\r?\n/, ''),
  };
}

/**
 * Read a YAML scalar, unwrapping repeated quoting. The committed landing title
 * may already be double-escaped (`title: "\"Hardware Guides\""`) by the old
 * frontMatterValue, so a single unwrap is not enough.
 */
function yamlScalar(lines, key) {
  const hit = (lines || []).find((line) => line.startsWith(`${key}:`));
  if (!hit) return null;
  let value = hit.slice(key.length + 1).trim();
  for (let i = 0; i < 8; i++) {
    if (value.length < 2 || !((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      break;
    }
    if (value.startsWith('"')) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        break;
      }
      if (typeof parsed !== 'string' || parsed === value) break;
      value = parsed;
    } else {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
  }
  return value;
}

function hardwareBodyParagraphs(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        // A `> lead` blockquote renders as an extra <p> on the mirror, exactly
        // like the official renderer does NOT do for its own `/hardware/` page.
        // Keep it here so a duplicated lead is visible as a paragraph mismatch.
        .filter((line) => line && !/^#/.test(line))
        .join(' '),
    )
    .map(normalizeStructureText)
    .filter(Boolean);
}

/**
 * Derive the local structure from the committed sidebar, manifest and landing
 * Markdown — no build/ directory needed, so the probe works in a fresh clone.
 * Dimensions without a baseline stay null and are reported as unavailable.
 */
export function localHardwareStructure({repo, pages = HARDWARE_STRUCTURE_PAGES} = {}) {
  const root = repo || process.cwd();
  const sidebarFile = path.join(root, 'sidebars-hardware.ts');
  if (!fs.existsSync(sidebarFile)) return {};
  const sidebar = fs.readFileSync(sidebarFile, 'utf8');
  const groups = [];
  const categoryRe = /\{\s*type:\s*['"]category['"],\s*label:\s*(['"])(.*?)\1,\s*items:\s*\[([^\]]*)\]/g;
  for (const match of sidebar.matchAll(categoryRe)) {
    groups.push({
      label: match[2],
      items: [...match[3].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]).filter(Boolean),
    });
  }
  const order = groups.flatMap((group) => group.items);
  const slugOf = (item) => String(item || '').split('/').pop() || '';
  const manifest = readJson(path.join(root, 'data/manifests/hardware.json'));
  const pagesBySlug = new Map(
    (manifest?.pages || []).map((page) => [String(page.slug || '').replace(/^\//, ''), page]),
  );
  const titleFor = (slug) => {
    const page = pagesBySlug.get(slug);
    if (page?.title) return String(page.title);
    return String(slug)
      .split(/[-_]/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  const pageLink = (index) => {
    const slug = slugOf(order[index]);
    return slug ? {label: titleFor(slug), slug} : null;
  };

  const indexFile = path.join(root, 'hardware/index.md');
  const landing = fs.existsSync(indexFile)
    ? parseMarkdownLite(fs.readFileSync(indexFile, 'utf8'))
    : null;
  const landingTitle = yamlScalar(landing?.lines || [], 'title') || 'Hardware Guides';
  const sampleSlug = String(pages.sample || '').replace(/^\/hardware\/|\/$/g, '');
  const sampleIndex = order.findIndex((item) => slugOf(item) === sampleSlug);

  return {
    landing: {
      categories: groups.length ? groups.map((group) => group.label) : null,
      paragraphs: landing ? hardwareBodyParagraphs(landing.body) : null,
      breadcrumb: [landingTitle],
      pagination: order.length ? {prev: null, next: pageLink(0)} : null,
    },
    sample: {
      categories: groups.length ? groups.map((group) => group.label) : null,
      paragraphs: null,
      breadcrumb: pagesBySlug.get(sampleSlug)?.title ? [String(pagesBySlug.get(sampleSlug).title)] : null,
      pagination: sampleIndex === -1
        ? null
        : {
            prev: sampleIndex === 0 ? {label: landingTitle, slug: ''} : pageLink(sampleIndex - 1),
            next: pageLink(sampleIndex + 1),
          },
    },
  };
}

// ---------------------------------------------------------------------------
// Standalone mode: `node tools/sync/lib/official-zones.mjs --zones`
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const result = await runZoneProbe({repo});
  for (const line of formatZoneProbe(result)) console.log(line);
  console.log(`official-zones: status=${result.changed ? 'changed' : 'unchanged'} reasons=${result.reasons.length}`);
  if (result.reasons.some((reason) => reason.startsWith('baseline-missing') || reason.includes('no local manifest'))) {
    process.exit(2);
  }
  process.exit(result.changed ? 10 : 0);
}
