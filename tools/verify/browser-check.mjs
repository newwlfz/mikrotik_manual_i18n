#!/usr/bin/env node
/**
 * Serve `build/` and run a few real-browser checks against the mirror.
 *
 *   node tools/verify/browser-check.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {REPO} from '../translate/lib/paths.mjs';
import {normalizeBaseUrl, resolveBaseUrl, resolveLocales} from '../lib/site-config.mjs';
import {chromium} from 'playwright-core';

const ROOT = path.join(REPO, 'build');
const PORT = Number(process.env.PORT || 4399);
const ORIGIN = `http://127.0.0.1:${PORT}`;
// 与 docusaurus.config.ts 同源：产物按部署前缀构建，静态服务器和访问路径
// 都必须先剥掉它，否则会去 `build/mikrotik_manual_i18n/` 找文件。
const BASE = normalizeBaseUrl(resolveBaseUrl().value);
const BASE_PREFIX = BASE === '/' ? '' : BASE.replace(/\/$/, '');

// 静态资源根（不带 locale）与各语种前缀：中文页的图片必须落在前者。
const ASSET_PREFIXES = [`${BASE}img/`, `${BASE}assets/images/`];
const {locales, defaultLocale} = resolveLocales();
const LOCALIZED_PREFIXES = locales
  .filter((locale) => locale !== defaultLocale)
  .map((locale) => `${BASE}${locale}/`);

/** 站点内路由 -> 浏览器/服务器实际路径（带 baseUrl 前缀）。 */
const urlOf = (route) => `${BASE_PREFIX}${route.startsWith('/') ? route : `/${route}`}`;

/** 实际路径 -> 站点内路由；不在 baseUrl 下时返回 null。 */
function stripBase(pathname) {
  if (!BASE_PREFIX) return pathname;
  if (pathname === BASE_PREFIX) return '/';
  if (pathname.startsWith(BASE)) return pathname.slice(BASE_PREFIX.length);
  return null;
}
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function sendNotFound(response, localized) {
  const notFound = path.join(ROOT, localized ? 'zh-Hans/404.html' : '404.html');
  response.writeHead(404, {'content-type': 'text/html; charset=utf-8'});
  fs.createReadStream(notFound).pipe(response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, ORIGIN);
  const requestPath = decodeURIComponent(url.pathname);
  const sitePath = stripBase(requestPath);
  if (sitePath === null) {
    if (requestPath === '/') {
      // 部署在项目子路径时 `/` 不属于本站；本地给一个人可读的入口。
      response.writeHead(302, {location: BASE});
      response.end();
      return;
    }
    sendNotFound(response, false);
    return;
  }
  let file = path.join(ROOT, sitePath);
  if (file.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // `docusaurus serve` answers an unknown route with the built 404 page, so the
    // app shell (and with it every client module) still loads. Returning bare
    // text here would hide the locale redirect and the consent gate on any route
    // the docs plugin did not emit, e.g. the `/docs/` landing route.
    sendNotFound(response, sitePath === '/zh-Hans' || sitePath.startsWith('/zh-Hans/'));
    return;
  }
  response.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || path.resolve(REPO, '../vendor/browsers/chrome-linux64/chrome'),
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
// The locale redirect and the consent gate have their own contexts below.
// Pre-seed this shared context so neither of them covers the clicks made by the
// pre-existing checks (a cookie is what both features read first).
await page.context().addCookies([
  {name: 'mikrotik_consent', value: '1', url: `${ORIGIN}${urlOf('/')}`},
  {name: 'docusaurus_locale', value: 'en', url: `${ORIGIN}${urlOf('/')}`},
]);
const results = [];
const check = (name, ok, detail = '') => {
  results.push({name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function open(route, scroll = false) {
  await page.goto(`${ORIGIN}${urlOf(route)}`, {waitUntil: 'load', timeout: 60000});
  await page.waitForTimeout(400);
  if (scroll) {
    // Lazy images only load once they enter the viewport, so walk the page.
    await page.evaluate(async () => {
      const step = Math.max(400, window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('img')].every((img) => img.complete),
        null,
        {timeout: 8000},
      )
      .catch(() => {});
    await page.waitForTimeout(300);
  }
}

// 1. Mermaid diagrams render as SVG.
await open('/docs/7.24/user-guides/routing-and-networking-protocols/routing-decision/');
await page
  .waitForSelector('.docusaurus-mermaid-container svg', {timeout: 25000})
  .catch(() => {});
const mermaid = await page.locator('.docusaurus-mermaid-container svg').count();
check('mermaid renders', mermaid > 0, `${mermaid} svg`);

// 2. Table cells keep their list structure.
await open('/docs/7.24/bridging-and-switching/');
const listCells = await page.locator('td ul li').count();
check('table cell lists', listCells > 100, `${listCells} li in cells`);

// 3. Netinstall rows have two cells.
await open('/docs/7.24/getting-started/installation-and-upgrade/netinstall/netinstall-linux/');
const netinstallCells = await page.evaluate(() => {
  const table = [...document.querySelectorAll('table')].find((t) => t.textContent.includes('--mac'));
  const row = table?.querySelectorAll('tbody tr')[0];
  return row ? row.children.length : 0;
});
check('netinstall row cells', netinstallCells === 2, `${netinstallCells} cells`);

// 4. Full-width table dialog opens over a backdrop and closes.
await open('/docs/7.24/getting-started/routeros-licensing/mikrotik-hardware/');
await page.locator('.wideTableToolbar button').first().click();
await page.waitForTimeout(300);
const modal = await page.evaluate(() => {
  const root = document.querySelector('.wideTableModalRoot');
  if (!root) return {open: false};
  const backdrop = root.querySelector('.wideTableBackdrop');
  return {
    open: true,
    role: root.getAttribute('role'),
    hasTable: Boolean(root.querySelector('.wideTableBody table')),
    backdropColor: backdrop ? getComputedStyle(backdrop).backgroundColor : null,
  };
});
check('wide table dialog opens', modal.open && modal.hasTable && modal.role === 'dialog', JSON.stringify(modal));
await page.locator('.wideTableBackdrop').click({position: {x: 5, y: 5}});
await page.waitForTimeout(250);
const closed = (await page.locator('.wideTableModalRoot').count()) === 0;
check('wide table closes on backdrop', closed);

// 5. Light/dark image pairs show exactly one image per theme.
await open('/docs/7.24/user-guides/routing-and-networking-protocols/routing-decision/', true);
const pair = await page.evaluate(() => {
  const images = [...document.querySelectorAll('img')].filter((img) => (img.getAttribute('src') || '').includes('#gh-'));
  return {
    total: images.length,
    visible: images.filter((img) => img.getBoundingClientRect().width > 0).length,
    loaded: images.filter((img) => img.naturalWidth > 0).length,
  };
});
check('dark/light image pair', pair.total === 2 && pair.visible === 1 && pair.loaded === 1, JSON.stringify(pair));

// 6. Images inside restored table cells load.
//
// The corpus is content-addressed (`/img/<sha256>`, emitted by the MDX loader
// as `assets/images/<hash>-<contenthash>.<ext>`), so a check cannot name the
// official file any more. What it can assert is the property that regressed
// once already: the picture sitting *inside a table cell* is rendered and its
// bytes arrive.
await open('/docs/7.24/hardware/mtu-in-routeros/', true);
const mtu = await page.evaluate(() => {
  const images = [...document.querySelectorAll('.theme-doc-markdown table img')];
  return {
    count: images.length,
    ok: images.length > 0 && images.every((element) => element.complete && element.naturalWidth > 0),
    src: images[0]?.currentSrc || null,
  };
});
check('mtu table image', mtu.ok, `${mtu.count} cell image(s): ${mtu.src || 'missing'}`);

// 7. Every picture on the page loads — including the two the site serves as
//    inlined data URIs (they are under Webpack's 10 kB limit).
await open('/docs/7.24/bridging-and-switching/user-guides/controller-bridge-and-port-extender/', true);
const cb = await page.evaluate(() =>
  [...document.querySelectorAll('.theme-doc-markdown img')].map((element) => ({
    ok: element.naturalWidth > 0,
    inline: (element.getAttribute('src') || '').startsWith('data:image'),
  })),
);
const cbOk = cb.length >= 6 && cb.every((item) => item.ok);
check('controller-bridge images', cbOk, `${cb.filter((item) => item.ok).length}/${cb.length} loaded (${cb.filter((item) => item.inline).length} inline)`);

// 8. Sidebar label used by the paginator.
await open('/docs/7.24/getting-started/first-time-configuration/');
const nextLabel = await page.locator('.pagination-nav__link--next .pagination-nav__label').innerText();
check('pagination label', nextLabel.trim() === 'Manual Network Setup', nextLabel.trim());

await open('/docs/7.24/getting-started/networking-fundamentals/');
const prevCount = await page.locator('.pagination-nav__link--prev').count();
check('no previous button', prevCount === 0, `${prevCount} prev anchors`);

// 9. Right-hand outline keeps all heading levels the official site lists (h2-h5).
await open('/docs/7.24/getting-started/networking-fundamentals/');
const toc = await page.evaluate(() => {
  const root = document.querySelector('.theme-doc-toc-desktop');
  if (!root) return {levels: 0, deep: false};
  let maxDepth = 0;
  const walk = (ul, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    for (const child of ul.children) walk(child, depth + (child.tagName === 'UL' ? 1 : 0));
  };
  walk(root.querySelector('ul'), 1);
  return {levels: maxDepth, deep: Boolean(root.querySelector('a[href="#point-to-point-addressing"]'))};
});
check('toc depth', toc.levels >= 3 && toc.deep, JSON.stringify(toc));

// 10. `Install` keeps its CHR subcategory instead of flattening it.
await open('/docs/7.24/getting-started/installation-and-upgrade/install/chr-installation/');
const install = await page.evaluate(() => {
  const li = [...document.querySelectorAll('.theme-doc-sidebar-menu li')].find(
    (element) => element.querySelector(':scope > div > a')?.textContent.trim() === 'Install',
  );
  const list = li?.querySelector(':scope > ul');
  const children = list ? [...list.children] : [];
  const chr = children.find((child) => child.textContent.includes('CHR: AWS'));
  return {
    children: children.length,
    hasChrCategory: Boolean(chr),
    chrChildren: chr?.querySelector(':scope > ul')?.children.length ?? 0,
  };
});
check('install keeps CHR subcategory', install.children === 2 && install.chrChildren >= 8, JSON.stringify(install));

// 11. A no-link category is not given one of its children's links.
await open('/docs/7.24/high-availability-solutions/');
const userGuides = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.theme-doc-sidebar-menu a')].filter(
    (a) => a.textContent.trim() === 'User Guides',
  );
  const withHash = items.filter((a) => a.getAttribute('href') === '#').length;
  return {count: items.length, withHash};
});
check('no-link category', userGuides.count === 1 && userGuides.withHash === 1, JSON.stringify(userGuides));

// 12. Chinese sidebar uses the translated short label, CLI names stay English.
await open('/zh-Hans/docs/7.24/getting-started/manual-network-setup/');
const zhLabel = await page.evaluate(() => {
  const a = [...document.querySelectorAll('.theme-doc-sidebar-menu a')].find((element) =>
    (element.getAttribute('href') || '').endsWith('/getting-started/manual-network-setup'),
  );
  return a ? a.textContent.trim() : null;
});
check('zh sidebar label', zhLabel === '手动网络设置', String(zhLabel));

await open('/zh-Hans/docs/7.24/cli-reference/caps-man/aaa/');
const zhCli = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.theme-doc-sidebar-menu a')]
    .filter((a) => (a.getAttribute('href') || '').includes('/cli-reference/'))
    .map((a) => a.textContent.trim());
  // Only the section title and the mirror-local `Version comparison` entry are
  // prose; every RouterOS menu name must stay English.
  const allowed = new Set(['CLI 参考', '版本比较']);
  const unexpected = labels.filter((label) => /[\u4e00-\u9fff]/.test(label) && !allowed.has(label));
  return {translated: [...new Set(labels.filter((label) => /[\u4e00-\u9fff]/.test(label)))], unexpected, total: labels.length};
});
check('zh CLI names stay English', zhCli.unexpected.length === 0, JSON.stringify(zhCli));

// 13. The packet-flow picture appears once.
//
// The regression this guards against was the same picture emitted twice (the
// page carried both a capture and the rebuilt block). A content-addressed URL
// makes that check sharper than a filename: two copies of one picture now share
// the same `<hash>` prefix, so "no duplicate article image" *is* "the picture
// appears once".
await open('/docs/7.24/bridging-and-switching/user-guides/controller-bridge-and-port-extender/', true);
const cbFlow = await page.evaluate(() => {
  const images = [...document.querySelectorAll('.theme-doc-markdown img')];
  const srcs = images.map((img) => img.getAttribute('src') || '');
  const duplicates = [...new Set(srcs.filter((src, index) => srcs.indexOf(src) !== index))];
  return {
    count: images.length,
    visible: images.filter((img) => img.getBoundingClientRect().width > 0).length,
    duplicates,
  };
});
check(
  'packet flow picture once',
  cbFlow.count >= 6 && cbFlow.duplicates.length === 0 && cbFlow.visible === cbFlow.count,
  JSON.stringify({count: cbFlow.count, visible: cbFlow.visible, duplicates: cbFlow.duplicates.length}),
);

// 14. The point-to-point diagram keeps the official line breaks and the box
//     grows with the text instead of letting it overflow.
await open('/docs/7.24/getting-started/networking-fundamentals/');
await page.waitForSelector('.docusaurus-mermaid-container svg foreignObject', {timeout: 30000, state: 'attached'});
const diagram = await page.evaluate(() => {
  const label = Array.from(document.querySelectorAll('.docusaurus-mermaid-container foreignObject div')).find((div) =>
    div.textContent.includes('Host 1'),
  );
  if (!label) return {found: false};
  const node = label.closest('g.node');
  const labelBox = label.getBoundingClientRect();
  const nodeBox = node.getBoundingClientRect();
  return {
    found: true,
    breaks: label.querySelectorAll('br').length,
    lines: label.textContent.split(/\n/).length,
    wraps: getComputedStyle(label).whiteSpace,
    overflow: Math.round(labelBox.width - nodeBox.width),
  };
});
check(
  'mermaid label layout',
  diagram.found && diagram.breaks === 3 && diagram.overflow <= 2,
  JSON.stringify(diagram),
);

// 15. Zoom is a Hardware Guides feature only: a Hardware picture opens and
//     closes, a Docs picture stays inert.
await open('/hardware/apa-1/', true);
const zoomed = await page.evaluate(async () => {
  const image = Array.from(document.querySelectorAll('.markdown img')).find(
    (img) => img.getBoundingClientRect().width > 120,
  );
  if (!image) return {found: false};
  const opacity = () => {
    const overlay = document.querySelector('.medium-zoom-overlay');
    return overlay ? Number(getComputedStyle(overlay).opacity) : 0;
  };
  image.click();
  await new Promise((resolve) => setTimeout(resolve, 700));
  const openedOpacity = opacity();
  image.click();
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {found: true, openedOpacity, closedOpacity: opacity()};
});
check(
  'hardware image zoom',
  zoomed.found && zoomed.openedOpacity > 0.5 && zoomed.closedOpacity === 0,
  JSON.stringify(zoomed),
);

await open('/docs/7.24/getting-started/networking-fundamentals/');
const docsZoom = await page.evaluate(() => {
  const image = Array.from(document.querySelectorAll('.markdown img')).find(
    (img) => img.getBoundingClientRect().width > 300,
  );
  if (!image) return {found: false};
  image.click();
  return {
    found: true,
    images: document.querySelectorAll('.markdown img').length,
  };
});
await page.waitForTimeout(600);
const docsOverlay = await page.evaluate(() => Boolean(document.querySelector('.medium-zoom-overlay')));
check(
  'docs pictures do not zoom',
  docsZoom.found && !docsOverlay,
  JSON.stringify({...docsZoom, overlay: docsOverlay}),
);

// 16. Standalone pictures and diagrams are centred in the docs column.
const centred = await page.evaluate(() => {
  // The diagram may sit inside a list item, so compare against its own block
  // (the container) rather than the whole markdown column.
  const container = document.querySelector('.docusaurus-mermaid-container');
  const svg = container?.querySelector('svg')?.getBoundingClientRect();
  const box = container?.getBoundingClientRect();
  const paragraph = Array.from(document.querySelectorAll('.markdown p')).find((element) =>
    element.querySelector(':scope > img:only-child'),
  );
  const leftGap = svg && box ? Math.round(svg.left - box.left) : null;
  const rightGap = svg && box ? Math.round(box.right - svg.right) : null;
  return {
    leftGap,
    rightGap,
    imageAlign: paragraph ? getComputedStyle(paragraph).textAlign : null,
  };
});
check(
  'docs media centred',
  centred.imageAlign === 'center' &&
    centred.leftGap !== null &&
    Math.abs(centred.leftGap - centred.rightGap) <= 4,
  JSON.stringify(centred),
);

// 16. Code blocks use the official RouterOS palette, and the coloured
//     enumeration values inside property tables survive the export.
await open('/docs/7.24/bridging-and-switching/user-guides/controller-bridge-and-port-extender/');
const palette = await page.evaluate(() => {
  const pre = document.querySelector('pre.prism-code');
  const command = pre?.querySelector('.token.command');
  return {
    background: pre ? getComputedStyle(pre).backgroundColor : null,
    color: pre ? getComputedStyle(pre).color : null,
    command: command ? {text: command.textContent, color: getComputedStyle(command).color} : null,
  };
});
check(
  'terminal palette',
  palette.background === 'rgb(250, 250, 250)' && palette.command?.color === 'rgb(80, 161, 79)',
  JSON.stringify(palette),
);

await open('/docs/7.24/bridging-and-switching/');
const enumColors = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('.ros-icon-success'));
  const unique = [...new Set(spans.map((span) => getComputedStyle(span).color))];
  return {count: spans.length, colors: unique};
});
check(
  'coloured enum values',
  enumColors.count > 5 && enumColors.colors.every((color) => color === 'rgb(34, 160, 107)'),
  JSON.stringify(enumColors),
);

// 17. A first-time visitor whose browser prefers Chinese lands on /zh-Hans,
//     while an English browser stays on the English tree. Each case needs its
//     own context: `locale` is fixed when the context is created and the first
//     visit only happens without the `docusaurus_locale` cookie. Start from a
//     real doc page (`/docs/introduction/`), not the `/docs/` landing route:
//     the latter only exists as a client-side redirect, so a 404 shell would
//     hide the difference between "the script ran" and "the page is real".
{
  const zhContext = await browser.newContext({locale: 'zh-CN'});
  const zhPage = await zhContext.newPage();
  await zhPage.goto(`${ORIGIN}${urlOf('/docs/introduction/')}`, {
    waitUntil: 'load',
    timeout: 60000,
  }).catch(() => {});
  await zhPage
    .waitForURL((url) => (stripBase(url.pathname) ?? '').startsWith('/zh-Hans/'), {timeout: 15000})
    .catch(() => {});
  const zhPath = new URL(zhPage.url()).pathname;
  await zhContext.close();

  const enContext = await browser.newContext({locale: 'en-US'});
  const enPage = await enContext.newPage();
  await enPage.goto(`${ORIGIN}${urlOf('/docs/introduction/')}`, {
    waitUntil: 'load',
    timeout: 60000,
  }).catch(() => {});
  await enPage.waitForTimeout(1200);
  const enPath = new URL(enPage.url()).pathname;
  await enContext.close();

  // 断言看的是站点内路径（剥掉 baseUrl 之后），与线上同形。
  const zhSitePath = stripBase(zhPath) ?? zhPath;
  const enSitePath = stripBase(enPath) ?? enPath;
  check(
    'locale auto-switch',
    zhSitePath.includes('/zh-Hans/') && !enSitePath.includes('/zh-Hans'),
    JSON.stringify({zh: zhPath, en: enPath}),
  );
}

// 17b. A language chosen in the navbar dropdown is remembered as an explicit
//      preference: a Chinese browser that picks English stays English after
//      returning to `/`, and picking Chinese again flips it back.
//
//      Regression: the old code wrote `docusaurus_locale=zh-Hans` on *auto*
//      redirect and the dropdown wrote nothing, so "Chinese browser → pick
//      English → next visit" was indistinguishable from a first visit and got
//      bounced back to Chinese.
{
  const context = await browser.newContext({locale: 'zh-CN'});
  // Keep the first-visit gate out of the way; it is asserted in case 18.
  await context.addCookies([
    {name: 'mikrotik_consent', value: '1', url: `${ORIGIN}${urlOf('/')}`},
  ]);
  const choicePage = await context.newPage();

  /** Hover the locale dropdown (desktop) and click the item for `lang`. */
  async function chooseLocale(lang) {
    const localeDropdown = choicePage
      .locator('.theme-layout-navbar-right .dropdown')
      .filter({has: choicePage.locator('a[lang]')})
      .first();
    const item = choicePage
      .locator(`.theme-layout-navbar-right .dropdown__menu a[lang="${lang}"]`)
      .first();
    const href = await item.getAttribute('href');
    await localeDropdown.hover();
    await item.click({timeout: 15000});
    if (href) {
      const target = new URL(href, ORIGIN).pathname;
      await choicePage
        .waitForURL((url) => url.pathname === target, {timeout: 15000})
        .catch(() => {});
    }
    await choicePage.waitForTimeout(600);
  }

  /** `location.replace` from the index page runs after hydration. */
  async function visitRoot() {
    await choicePage.goto(`${ORIGIN}${urlOf('/')}`, {waitUntil: 'load', timeout: 60000});
    await choicePage
      .waitForURL(
        (url) => {
          const site = stripBase(url.pathname) ?? '';
          return site === '/docs/introduction/' || site === '/zh-Hans/docs/introduction/';
        },
        {timeout: 15000},
      )
      .catch(() => {});
    await choicePage.waitForTimeout(300);
    return stripBase(new URL(choicePage.url()).pathname) || '';
  }

  // A Chinese browser first lands on the Chinese tree (head script), then the
  // user explicitly switches to English in the dropdown.
  await choicePage.goto(`${ORIGIN}${urlOf('/docs/introduction/')}`, {
    waitUntil: 'load',
    timeout: 60000,
  }).catch(() => {});
  await choicePage
    .waitForURL((url) => (stripBase(url.pathname) ?? '').startsWith('/zh-Hans/'), {timeout: 15000})
    .catch(() => {});
  const zhFirst = stripBase(new URL(choicePage.url()).pathname) || '';
  await chooseLocale('en');
  const afterSwitch = stripBase(new URL(choicePage.url()).pathname) || '';
  const cookiesAfterEn = await context.cookies();
  const explicitAfterEn = cookiesAfterEn.find((cookie) => cookie.name === 'docusaurus_locale')?.value ?? null;
  const storedAfterEn = await choicePage.evaluate(() => localStorage.getItem('docusaurus_locale'));

  // The regression: returning to `/` must honour `en`, not the zh browser.
  const afterRootEn = await visitRoot();
  const enOk =
    zhFirst.startsWith('/zh-Hans/') &&
    afterSwitch.startsWith('/docs/') &&
    !afterSwitch.startsWith('/zh-Hans/') &&
    explicitAfterEn === 'en' &&
    storedAfterEn === 'en' &&
    afterRootEn.startsWith('/docs/') &&
    !afterRootEn.startsWith('/zh-Hans/');

  // Pick Chinese again on the English page; `/` must go back to the zh tree.
  await chooseLocale('zh-Hans');
  const cookiesAfterZh = await context.cookies();
  const explicitAfterZh = cookiesAfterZh.find((cookie) => cookie.name === 'docusaurus_locale')?.value ?? null;
  const afterRootZh = await visitRoot();
  await context.close();

  check(
    'locale choice persists',
    enOk && explicitAfterZh === 'zh-Hans' && afterRootZh.startsWith('/zh-Hans/'),
    JSON.stringify({
      zhFirst,
      afterSwitch,
      explicitAfterEn,
      storedAfterEn,
      afterRootEn,
      explicitAfterZh,
      afterRootZh,
    }),
  );
}

// 18. The first visit shows the consent dialog; accepting it (or its cookie)
//     hides it for good, and the copy follows the locale.
//
//     The gate is entered from a real doc page (`/docs/introduction/`), not the
//     `/docs/` landing route: that route exists only as a client-side redirect,
//     and there Docusaurus' mobile nav `useLockBodyScroll` cleanup writes
//     `document.body.style.overflow` back to `visible` after the dialog mounts,
//     so the scroll lock reads `false` although the component is correct. The
//     lock is still asserted — on the same route a reader actually lands on.
{
  const context = await browser.newContext();
  const gatePage = await context.newPage();
  await gatePage.goto(`${ORIGIN}${urlOf('/docs/introduction/')}`, {
    waitUntil: 'load',
    timeout: 60000,
  });
  const dialog = gatePage.locator('[data-testid="consent-gate"] [role="dialog"]');
  await dialog.waitFor({state: 'visible', timeout: 15000}).catch(() => {});
  const visible = await dialog.isVisible().catch(() => false);
  // The gate writes the lock in an effect right after it mounts; wait for the
  // value instead of racing it, without weakening the assertion.
  await gatePage
    .waitForFunction(() => document.body.style.overflow === 'hidden', null, {timeout: 2000})
    .catch(() => {});
  const locked = await gatePage.evaluate(() => document.body.style.overflow === 'hidden');
  const focused = await gatePage.evaluate(
    () => document.activeElement?.getAttribute('data-testid') === 'consent-accept',
  );
  await gatePage.locator('[data-testid="consent-accept"]').click();
  await gatePage.waitForTimeout(250);
  const dismissed = (await gatePage.locator('[data-testid="consent-gate"]').count()) === 0;
  const unlocked = await gatePage.evaluate(() => document.body.style.overflow !== 'hidden');
  await gatePage.reload({waitUntil: 'load'});
  await gatePage.waitForTimeout(600);
  const afterReload = (await gatePage.locator('[data-testid="consent-gate"]').count()) === 0;
  await context.close();

  const zhContext = await browser.newContext({locale: 'zh-CN'});
  const zhPage = await zhContext.newPage();
  await zhPage.goto(`${ORIGIN}${urlOf('/zh-Hans/docs/')}`, {waitUntil: 'load', timeout: 60000});
  const zhGate = zhPage.locator('[data-testid="consent-gate"]');
  await zhGate.waitFor({state: 'visible', timeout: 15000}).catch(() => {});
  const zhText = (await zhGate.innerText().catch(() => '')) || '';
  await zhContext.close();
  const chinese = /我已了解|翻译/.test(zhText);

  check(
    'consent gate',
    visible && locked && focused && dismissed && unlocked && afterReload && chinese,
    JSON.stringify({visible, locked, focused, dismissed, unlocked, afterReload, chinese}),
  );
}

// 19. The provenance block precedes the stock footer. The English page has an
//     official URL and a capture time; the Chinese page additionally has the
//     translation time and "provider · model".
//
//     `translated_at` / `translation_provider` / `translation_model` are
//     appended to every overlay's front matter by
//     `tools/translate/backfill-provenance.mjs` (and by translate apply/derive
//     from now on). REQUIRED_BACKFILL is true: a Chinese page must show all
//     three fields, and `backfillPending` stays in the details so a regression
//     reports which half is missing.
{
  const REQUIRED_BACKFILL = true;
  const context = await browser.newContext({locale: 'en-US'});
  // The footer does not depend on the gate, but seeding consent keeps the
  // overlay out of the way while the block is read.
  await context.addCookies([
    {name: 'mikrotik_consent', value: '1', url: `${ORIGIN}${urlOf('/')}`},
  ]);
  const footerPage = await context.newPage();

  async function readFooter(route) {
    await footerPage.goto(`${ORIGIN}${urlOf(route)}`, {waitUntil: 'load', timeout: 60000});
    // The timestamp is formatted after hydration (SSR runs in another time zone).
    await footerPage.waitForTimeout(500);
    await footerPage
      .waitForFunction(
        () => {
          const time = document.querySelector('[data-testid="source-footer-captured"]');
          const times = [...document.querySelectorAll('[data-testid="source-footer-line"] time')];
          return Boolean(time && time.textContent.trim()) && times.every((node) => node.textContent.trim());
        },
        null,
        {timeout: 8000},
      )
      .catch(() => {});
    return footerPage.evaluate(() => {
      const footer = document.querySelector('[data-testid="source-footer"]');
      const source = document.querySelector('[data-testid="source-footer-source"]');
      const captured = document.querySelector('[data-testid="source-footer-captured"]');
      const translated = document.querySelector('[data-testid="source-footer-translated"]');
      const provider = document.querySelector('[data-testid="source-footer-provider"]');
      const model = document.querySelector('[data-testid="source-footer-model"]');
      // 采集 / 翻译 / 提供商 / 模型 现在合并成一行，同一个 testid 容器。
      const line = document.querySelector('[data-testid="source-footer-line"]');
      const labels = line
        ? [...line.querySelectorAll('[data-testid^="source-footer-label-"]')]
            .map((node) => node.textContent?.trim() || '')
            .filter(Boolean)
        : [];
      // 每个字段的标签与值必须在同一行容器里，且整块只有「原文 URL」和
      // 「一行元信息」两行，避免又退回成每项一行。
      const rows = footer ? footer.querySelectorAll('.sourceFooterRow').length : 0;
      const fieldsInLine = line
        ? [...line.querySelectorAll('[data-testid^="source-footer-field-"]')].length
        : 0;
      // 每个字段必须渲染成「标签：值」；标签与值之间没有标点时，屏幕上会
      // 粘成 `CapturedNov 9, 2026`（用户报告的问题）。
      const fieldTexts = line
        ? [...line.querySelectorAll('[data-testid^="source-footer-field-"]')].map(
            (node) => node.textContent?.trim() || '',
          )
        : [];
      return {
        footer: Boolean(footer),
        href: source?.getAttribute('href') || '',
        sourceText: source?.textContent?.trim() || '',
        captured: captured?.textContent?.trim() || '',
        translated: translated?.textContent?.trim() || '',
        provider: provider?.textContent?.trim() || '',
        model: model?.textContent?.trim() || '',
        hasTranslated: Boolean(translated),
        hasProvider: Boolean(provider),
        hasModel: Boolean(model),
        line: Boolean(line),
        lineText: line?.textContent?.trim() || '',
        lineLabels: labels,
        fieldTexts,
        fieldsInLine,
        rows,
      };
    });
  }

  const english = await readFooter('/docs/7.25/getting-started/first-time-configuration/');
  const englishOk =
    english.footer && english.href.includes('manual.mikrotik.com') && english.captured.length > 0;

  const chinese = await readFooter('/zh-Hans/docs/7.25/getting-started/first-time-configuration/');
  const backfillPending = !chinese.hasTranslated && !chinese.hasModel;
  // 用户 #18：中文页四个字段（采集时间 / 翻译时间 / 服务提供商 / 模型）
  // 必须都在，且必须落在**同一行**——同一个 [data-testid="source-footer-line"]
  // 容器里、整块只有两行（官方原文 URL + 这一行），不再是一项一行。
  const CHINESE_LABELS = ['采集时间', '翻译时间', '服务提供商', '模型'];
  const missingLabels = CHINESE_LABELS.filter((label) => !chinese.lineText.includes(label));
  // Label/value punctuation is independent of the locale: English uses `: `,
  // Chinese the full-width `：`. A field with no value is not rendered at all,
  // so every rendered field must have a visible value after the colon.
  const FIELD_TEXT_RE = /^[^：:]+[：:]\s*\S/;
  const malformedFields = [...english.fieldTexts, ...chinese.fieldTexts].filter(
    (text) => !FIELD_TEXT_RE.test(text),
  );
  const fieldsPunctuated = malformedFields.length === 0;
  const allInOneLine =
    chinese.line &&
    chinese.fieldsInLine === CHINESE_LABELS.length &&
    chinese.rows === 2 &&
    chinese.lineLabels.length === CHINESE_LABELS.length;
  const chineseOk = backfillPending
    ? !REQUIRED_BACKFILL
    : chinese.hasTranslated &&
      chinese.hasModel &&
      chinese.hasProvider &&
      chinese.translated.length > 0 &&
      chinese.provider.length > 0 &&
      chinese.model.length > 0 &&
      missingLabels.length === 0 &&
      fieldsPunctuated &&
      allInOneLine;
  await context.close();

  check(
    'source footer',
    englishOk && chineseOk,
    JSON.stringify({
      english,
      chinese,
      backfillPending,
      missingLabels,
      malformedFields,
      fieldsPunctuated,
      allInOneLine,
    }),
  );
}

// 20/21. 站内客户端跳转后，图片必须落在**不带 locale** 的静态资源根上。
//
// 回归点：Docusaurus 3.10 给非默认语种把 `siteConfig.baseUrl` 改成
// `/mikrotik_manual_i18n/zh-Hans/`（`@docusaurus/core/lib/server/site.js:64-67`），
// 这个值被烘进 `build/zh-Hans/assets/js/main.*.js`：`useBaseUrl` 产出
// `/…/zh-Hans/img/<hash>`，webpack 的 `output.publicPath` 产出
// `/…/zh-Hans/assets/images/<hash>`。`tools/build/slim.mjs` 只改写
// HTML/XML/JSON 并删掉每个语种目录下的图片副本，所以 HTML 是对的、客户端
// 新插入的 DOM 是 404 的——只有站内跳转才暴露。
//
// 修复：静态资源统一走 `customFields.assetBaseUrl`（`<Img>`、导航 Logo、
// favicon、webpack 的 file/url-loader publicPath），路由仍用 `useBaseUrl`。
// 断言看三件事：跳转过程中没有 `/zh-Hans/{img,assets/images}/` 的 404；页面上
// 所有非 data: 图片的 src 都在资源根下；至少一张图真的解码成功。
async function clientNavigationImages(startRoute, selector) {
  const asset404 = [];
  const onResponse = (response) => {
    if (response.status() !== 404) return;
    const {pathname} = new URL(response.url());
    if (LOCALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      asset404.push(pathname);
    }
  };
  page.on('response', onResponse);
  try {
    await page.goto(`${ORIGIN}${urlOf(startRoute)}`, {waitUntil: 'load', timeout: 60000});
    await page.waitForTimeout(400);
    // 站点内跳转不能整页重载：标记在客户端路由切换后仍在。
    await page.evaluate(() => {
      window.__clientNavigation = true;
    });
    const link = page.locator(selector).first();
    const href = await link.getAttribute('href', {timeout: 15000});
    await link.click({timeout: 15000});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const info = await page.evaluate((assetPrefixes) => {
      const images = [...document.images];
      const wrong = images
        .map((image) => image.getAttribute('src') || '')
        // `data:` 图片是内联字节，不会发请求；其余必须落在资源根下。
        .filter((src) => src && !src.startsWith('data:') && !assetPrefixes.some((prefix) => src.startsWith(prefix)));
      return {
        path: location.pathname,
        clientNavigation: window.__clientNavigation === true,
        images: images.length,
        loaded: images.filter((image) => image.naturalWidth > 0).length,
        wrong: [...new Set(wrong)].slice(0, 5),
      };
    }, ASSET_PREFIXES);
    return {href, ...info, asset404: [...new Set(asset404)].slice(0, 5)};
  } catch (error) {
    return {href: null, error: String(error), asset404: [...new Set(asset404)].slice(0, 5)};
  } finally {
    page.off('response', onResponse);
  }
}

// 列表页上的第一个 hardware 链接就是分页器指向的第一篇（与侧边栏首项同一页）。
const zhNavigation = await clientNavigationImages(
  '/zh-Hans/hardware/',
  `.pagination-nav__link--next[href^="${BASE}zh-Hans/hardware/"]`,
);
check(
  'zh client navigation images',
  Boolean(zhNavigation.href) &&
    zhNavigation.clientNavigation === true &&
    zhNavigation.asset404.length === 0 &&
    zhNavigation.wrong.length === 0 &&
    zhNavigation.loaded > 0,
  JSON.stringify(zhNavigation),
);

// 英文对照：同一次跳转在默认语种下不应有任何 404（修复前后都应通过）。
const enNavigation = await clientNavigationImages(
  '/hardware/',
  `.pagination-nav__link--next[href^="${BASE}hardware/"]`,
);
check(
  'en client navigation images',
  Boolean(enNavigation.href) &&
    enNavigation.clientNavigation === true &&
    enNavigation.asset404.length === 0 &&
    enNavigation.wrong.length === 0 &&
    enNavigation.loaded > 0,
  JSON.stringify(enNavigation),
);

// 22. The navbar search box returns results instead of crashing.
//
// Regression: the baseUrl rewrite (762ac6d) dropped the local `locale` constant
// but left the CLI section heading reading it, so the first CLI result rendered
// `ReferenceError: locale is not defined` inside `custom-SearchBox`. The navbar
// error boundary swallowed the item: "A theme navbar item failed to render".
// Typing only reaches that branch for a term with CLI hits ("router" has plenty),
// which is why the crash showed up after a query and not on page load.
{
  const consoleErrors = [];
  const uncaught = [];
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onPageError = (error) => uncaught.push(String(error));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await open('/zh-Hans/docs/introduction/');
    const input = page.locator('.site-search__input');
    await input.waitFor({state: 'visible', timeout: 10000});
    await input.click();
    await input.type('router', {delay: 30});
    await page.waitForTimeout(1500);
    // The first search loads every result's fragment, so allow the async side to
    // settle; the assertion below still sees whatever state the page reached.
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll('.site-search__result').length > 0 ||
          /A theme navbar item failed to render|页面已崩溃|This page crashed/.test(
            document.body.innerText,
          ),
        null,
        {timeout: 20000},
      )
      .catch(() => {});
    const state = await page.evaluate(() => {
      const results = [...document.querySelectorAll('.site-search__result')];
      return {
        crashed: /A theme navbar item failed to render|页面已崩溃|This page crashed/.test(
          document.body.innerText,
        ),
        input: document.querySelector('.site-search__input')?.value ?? null,
        results: results.length,
        firstHref: results[0]?.querySelector('.site-search__result-link')?.getAttribute('href') ?? null,
        status: (document.querySelector('.site-search__status')?.textContent || '').trim(),
      };
    });
    const localeErrors = consoleErrors.filter((text) => /locale is not defined/.test(text));
    const failed =
      state.crashed ||
      state.results < 1 ||
      !state.firstHref ||
      localeErrors.length > 0 ||
      uncaught.length > 0;
    check(
      'search works',
      !failed,
      JSON.stringify({
        ...state,
        localeErrors: localeErrors.map((text) => text.split('\n')[0]).slice(0, 2),
        uncaught: uncaught.map((text) => text.split('\n')[0]).slice(0, 2),
      }),
    );
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

await browser.close();
server.close();

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({checks: results.length, failed: failed.length}, null, 0));
if (failed.length) process.exitCode = 1;
