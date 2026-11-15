import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ||
  path.resolve('../vendor/browsers/chrome-linux64/chrome');
const OUT = '../reports/visual';
const LOCAL = 'http://127.0.0.1:3000';
const OFFICIAL = 'https://manual.mikrotik.com';

const pages = [
  ['docs-7.25', '/docs/introduction', '/docs/7.25/introduction'],
  ['docs-7.24', '/docs/7.24/introduction', '/docs/7.24/introduction'],
  ['hardware', '/hardware/netmetal-ax', '/hardware/netmetal-ax'],
  ['blog', '/blog/news135', '/blog/news135'],
  ['changelog', '/changelog/changelog-2026-11-03', '/changelog/changelog-2026-11-03'],
  ['compare', '/docs/cli-reference/compare-versions/', '/docs/cli-reference/compare-versions/'],
];

fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

async function inspect(page) {
  return page.evaluate(() => {
    const text = (selector) =>
      [...document.querySelectorAll(selector)].map((el) => el.textContent.trim()).filter(Boolean);
    const article = document.querySelector('article') || document.querySelector('main');
    return {
      title: document.title,
      htmlClass: document.documentElement.className,
      navbar: text('nav.navbar a, nav.navbar button'),
      sidebar: text('nav[aria-label="Docs sidebar"] > ul > li'),
      h1: text('h1'),
      h2Count: document.querySelectorAll('h2').length,
      tables: document.querySelectorAll('table').length,
      images: document.querySelectorAll('article img, main img').length,
      textLength: article?.innerText.length ?? 0,
      footer: text('footer a'),
    };
  });
}

async function capture(name, localPath, officialPath) {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  const localUrl = LOCAL + localPath;
  await page.goto(localUrl, {waitUntil: 'domcontentloaded', timeout: 90000});
  await page.waitForTimeout(1200);
  const local = await inspect(page);
  await page.screenshot({path: path.join(OUT, `${name}-local.png`), fullPage: false});
  await page.close();

  const officialPage = await browser.newPage({viewport: {width: 1440, height: 900}});
  const officialUrl = OFFICIAL + officialPath;
  await officialPage.goto(officialUrl, {waitUntil: 'domcontentloaded', timeout: 90000});
  await officialPage.waitForTimeout(2500);
  const official = await inspect(officialPage);
  await officialPage.screenshot({
    path: path.join(OUT, `${name}-official.png`),
    fullPage: false,
  });
  await officialPage.close();
  return {name, local_path: localPath, official_path: officialPath, local_url: localUrl, official_url: officialUrl, local, official};
}

const results = [];
for (const [name, localPath, officialPath] of pages) {
  try {
    const result = await capture(name, localPath, officialPath);
    results.push(result);
    console.log(`captured ${name}`);
  } catch (error) {
    console.error(`FAILED ${name}: ${error.message}`);
    results.push({name, local_path: localPath, official_path: officialPath, error: error.message});
  }
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2) + '\n');

const cards = results
  .map((r) => {
    if (r.error) return `<h2>${r.name}</h2><p class="error">${r.error}</p>`;
    return `<section>
      <h2>${r.name}</h2>
      <p><code>${r.local_path}</code> vs <code>${r.official_path}</code></p>
      <div class="pair">
        <figure><img src="${r.name}-local.png"><figcaption>local</figcaption></figure>
        <figure><img src="${r.name}-official.png"><figcaption>official</figcaption></figure>
      </div>
      <pre>${JSON.stringify({local: r.local, official: r.official}, null, 2)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')}</pre>
    </section>`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(OUT, 'report.html'),
  `<!doctype html><meta charset="utf-8"><title>Visual verification</title>
<style>body{font:14px/1.5 system-ui;margin:2rem;max-width:1400px}h2{margin-top:2rem}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:1rem}figure{margin:0}img{width:100%;border:1px solid #ddd}
pre{background:#f6f8fa;padding:1rem;overflow:auto;max-height:28rem}figcaption{font-weight:700;padding:.4rem 0}</style>
<h1>Local vs official</h1>${cards}`,
);

await browser.close();
console.log(`wrote ${OUT}/report.html`);
