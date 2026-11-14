import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';

const BASE = 'https://manual.mikrotik.com';
const CHROME =
  process.env.CHROME_PATH ||
  path.resolve('../vendor/browsers/chrome-linux64/chrome');
const manifest = JSON.parse(
  fs.readFileSync('data/manifests/blog-changelog.json', 'utf8'),
);
const remote = manifest.changelog
  .filter((u) => !u.includes('/page/'))
  .map((u) => u.split('/').at(-1));
const local = new Set(
  fs
    .readdirSync('changelog')
    .filter((f) => f.startsWith('changelog-') && f.endsWith('.md'))
    .map((f) => f.slice(0, -3)),
);
const missing = remote.filter((slug) => !local.has(slug));
console.log('missing', missing.length, missing);

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndown.use(gfm);
turndown.addRule('keepDetails', {
  filter: ['details'],
  replacement: (content, node) => `\n${node.outerHTML}\n`,
});

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});

for (const slug of missing) {
  const url = `${BASE}/changelog/${slug}`;
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
  await page.waitForSelector('article', {timeout: 45000});
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => {
    const article = document.querySelector('article');
    const time = article?.querySelector('time');
    return {
      title: article?.querySelector('h1')?.textContent?.trim() || document.title,
      date: time?.getAttribute('datetime') || time?.textContent?.trim() || '',
      html: article?.innerHTML || '',
    };
  });
  const body = turndown.turndown(data.html).trim();
  const date =
    data.date ||
    (slug.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] ||
    new Date().toISOString().slice(0, 10);
  const fm = `---\ntitle: ${JSON.stringify(data.title)}\ndate: ${date}\nslug: /${slug}\n---\n\n`;
  fs.writeFileSync(path.join('changelog', `${slug}.md`), fm + body + '\n');
  console.log('wrote', slug, body.length);
}

await browser.close();
