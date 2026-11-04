import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const BASE = 'https://manual.mikrotik.com';
const ROOT = '/docs/7.24/introduction';
const CHROME =
  process.env.CHROME_PATH ||
  path.resolve('../vendor/browsers/chrome-linux64/chrome');
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'data/manifests/docs-7.24-sidebar.json';

function docId(href) {
  if (!href || !href.startsWith('/docs/7.24/')) return null;
  let p = href.slice('/docs/7.24/'.length);
  p = p.replace(/\/+$/, '');
  if (p === '') return null;
  // Category routes ending in "/" become <dir>/index. A non-category route
  // maps to <path>.md / doc id <path>.
  return href.endsWith('/') ? `${p}/index` : p;
}

async function readEntries(page, currentPath) {
  return page.evaluate((currentPath) => {
    const nav = document.querySelector('nav[aria-label="Docs sidebar"]');
    if (!nav) throw new Error('sidebar missing');
    const parse = (ul) =>
      [...ul.children]
        .filter((li) => li.classList.contains('menu__list-item'))
        .map((li) => {
          const a = li.querySelector(
            ':scope > .menu__list-item-collapsible > a, :scope > a',
          );
          return {
            label: (a?.textContent || '').trim(),
            href: a?.getAttribute('href') || null,
            sublist: a?.classList.contains('menu__link--sublist') || false,
          };
        });

    const active = [...nav.querySelectorAll('a.menu__link--sublist')].find(
      (a) => a.getAttribute('href') === currentPath,
    );
    if (active) {
      const li = active.closest('li');
      const ul = li?.querySelector(':scope > ul.menu__list');
      if (ul) return {entries: parse(ul), scope: 'category'};
    }
    const root = nav.querySelector('ul.theme-doc-sidebar-menu');
    return root ? {entries: parse(root), scope: 'root'} : {entries: [], scope: 'none'};
  }, currentPath);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});

const categories = new Map();
const routes = new Map();
const queue = [];
let rootEntries = [];

async function visit(url) {
  await page.goto(BASE + url, {waitUntil: 'domcontentloaded', timeout: 90000});
  await page.waitForSelector('nav[aria-label="Docs sidebar"]', {timeout: 45000});
  await page.waitForTimeout(250);
  const pathname = new URL(page.url()).pathname;
  const {entries, scope} = await readEntries(page, pathname);
  if (scope === 'root') rootEntries = entries;
  if (scope === 'category') categories.set(pathname, entries);
  for (const e of entries) {
    if (!e.href) continue;
    routes.set(e.href, e.label);
    if (e.sublist && e.href.endsWith('/') && !categories.has(e.href)) {
      queue.push(e.href);
    }
  }
  console.log(`${scope.padEnd(8)} ${pathname} -> ${entries.length}`);
}

await visit(ROOT);

const seen = new Set();
while (queue.length) {
  const next = queue.shift();
  if (seen.has(next)) continue;
  seen.add(next);
  try {
    await visit(next);
  } catch (error) {
    console.error('FAILED', next, error.message);
  }
}

function buildTree(entries, seen = new Set(), depth = 0) {
  return entries.map((e) => {
    if (!e.href) return null;
    const id = docId(e.href);
    if (e.sublist) {
      // A category page can include its own link in the rendered child list.
      // Never recurse into a category already on this branch.
      if (seen.has(e.href) || depth > 24) return null;
      const nextSeen = new Set(seen);
      nextSeen.add(e.href);
      const children = categories.get(e.href) || [];
      const items = buildTree(children, nextSeen, depth + 1);
      if (!id && items.length === 0) return null;
      return {
        type: 'category',
        label: e.label,
        ...(id ? {link: {type: 'doc', id}} : {}),
        items,
      };
    }
    return id ? {type: 'doc', id} : null;
  }).filter(Boolean);
}

const tree = buildTree(rootEntries);
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify({docs: tree}, null, 2) + '\n');
fs.writeFileSync(
  OUT.replace(/\.json$/, '.routes.json'),
  JSON.stringify(
    [...routes.entries()].map(([href, label]) => ({
      href,
      label,
      id: docId(href),
    })),
    null,
    2,
  ) + '\n',
);

console.log(`categories=${categories.size} routes=${routes.size}`);
console.log(`wrote ${OUT}`);
await browser.close();
