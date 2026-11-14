#!/usr/bin/env node
/**
 * `npm run build` with a production-sized heap.
 *
 * The static renderer is the peak; without this wrapper a big pass can die with
 * "FATAL ERROR: Reached heap limit" after half the output is already written.
 * The heap is set here, not in `.env`, so a plain `npm run build` works in any
 * shell (CI included).
 *
 * ## Monolingual mode
 *
 * This repository builds **English only**. When `SITE_LOCALE` is set (for
 * example `SITE_LOCALE=en npm run build`) the Docusaurus step runs
 *
 *   docusaurus build --locale <SITE_LOCALE> --out-dir build
 *
 * `--out-dir` is passed explicitly on purpose: it is the directory Docusaurus
 * wipes before rendering, and spelling it out keeps that destructive default
 * visible next to the locale flag. Every later step (pagefind, llms.txt) then
 * walks the same `build/`, which holds one locale, so nothing downstream has to
 * know about the other one.
 *
 * Without `SITE_LOCALE` the wrapper keeps the old behaviour: Docusaurus builds
 * every declared locale into `build/`. That mode is only useful for a
 * same-repo bilingual site, which this repository is not.
 *
 * Extra arguments go to `docusaurus build`:
 *   node tools/build/index.mjs --locale en
 */

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEAP_MB = Number(process.env.BUILD_HEAP_MB || 10240);
const current = process.env.NODE_OPTIONS || '';
const nodeOptions = /--max-old-space-size=/.test(current)
  ? current
  : `${current} --max-old-space-size=${HEAP_MB}`.trim();

/**
 * `ASSET_ORIGIN`（共享资源源站，带路径前缀，不带尾斜杠）。
 *
 * 设置时 `docusaurus.config.ts` 把 `staticDirectories` 设成空数组，站内资源
 * 引用改写到该源站，`static/` 不再参与构建。这里只负责把模式说清楚，并在
 * 发现遗留 `static/` 内容时警告：它会被**忽略**，不是被合并。旧构建可能在
 * `static/` 里留下 `cli/` 与 `cli-compare.json`（现在 `ASSET_ORIGIN` 模式把
 * 它们写进 `work/cli/`），这两个不算遗留内容。
 */
const assetOrigin = (process.env.ASSET_ORIGIN || '').trim().replace(/\/+$/, '');
const STATIC_DIR = path.join(REPO, 'static');
const GENERATED_STATIC_ENTRIES = new Set(['cli', 'cli-compare.json']);

function warnAboutIgnoredStatic() {
  if (!fs.existsSync(STATIC_DIR) || !fs.statSync(STATIC_DIR).isDirectory()) return;
  const leftovers = fs
    .readdirSync(STATIC_DIR)
    .filter((entry) => !GENERATED_STATIC_ENTRIES.has(entry));
  if (leftovers.length === 0) return;
  console.warn(
    `[build] WARN ASSET_ORIGIN is set: static/ is ignored by this build ` +
      `(staticDirectories = []). Leftover entries: ${leftovers.join(', ')}. ` +
      'Remove static/ — localized repositories serve assets from the shared origin.',
  );
}

if (assetOrigin) {
  console.log(`[build] shared asset origin: ${assetOrigin} (static/ is not published)`);
  warnAboutIgnoredStatic();
} else if (!fs.existsSync(STATIC_DIR) || !fs.statSync(STATIC_DIR).isDirectory()) {
  console.warn(
    '[build] WARN static/ is missing and ASSET_ORIGIN is unset: root-absolute ' +
      'asset references (/img/…, /assets/…, /videos/…) will 404. Set ASSET_ORIGIN ' +
      'to the asset host (see guides/CI.md) or restore static/.',
  );
}

const extraArgs = process.argv.slice(2);
const hasLocaleArg = extraArgs.some(
  (arg) => arg === '--locale' || arg.startsWith('--locale='),
);
// `SITE_LOCALE` is also read by `tools/build/llms.mjs`; an explicit `--locale`
// on the command line wins so the two steps can never disagree.
const siteLocale = (process.env.SITE_LOCALE || '').trim();
const singleLocale = siteLocale && !hasLocaleArg ? siteLocale : null;

if (singleLocale) {
  console.log(`[build] single-locale mode: --locale ${singleLocale} --out-dir build`);
} else if (!siteLocale) {
  console.log('[build] no SITE_LOCALE: Docusaurus builds every declared locale');
}

const buildArgs = [
  'docusaurus',
  'build',
  '--out-dir',
  'build',
  ...(singleLocale ? ['--locale', singleLocale] : []),
  ...extraArgs,
];

const steps = [
  ['npm', ['run', 'cli:build']],
  ['npx', buildArgs],
  // pagefind indexes whatever is in `build/`: in single-locale mode that is the
  // English tree only, so the search index has no Chinese entries either.
  ['npx', ['pagefind', '--site', 'build']],
  // llms.txt 用官方结构重写（分类 + 绝对 URL + 英文标题），每个版本目录一份。
  // 插件仍会先生成一份，这里在 build 末尾覆盖成官方结构。
  ['node', ['tools/build/llms.mjs']],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    cwd: REPO,
    stdio: 'inherit',
    env: {...process.env, NODE_OPTIONS: nodeOptions},
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * `ASSET_ORIGIN` 模式下 `cli:build` 把数据写进 `work/cli/`（本产物不发布
 * `static/`）。但 `cli-compare.json` 是 `src/components/CliCompare` 用
 * `fetch()` 读的：跨域请求需要 CORS，而英文站（GitHub Pages）不返回
 * `Access-Control-Allow-Origin`，所以它在任何模式下都必须留在本站。这里把它
 * 放到产物根，与 pagefind 索引同级。
 */
if (assetOrigin) {
  const source = path.join(REPO, 'work', 'cli', 'cli-compare.json');
  const target = path.join(REPO, 'build', 'cli-compare.json');
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    console.log(
      `[build] published ${path.relative(REPO, target)} from work/cli ` +
        '(local: the asset host sends no CORS headers)',
    );
  } else {
    console.warn(
      '[build] WARN work/cli/cli-compare.json is missing: the CLI compare page will not load',
    );
  }
}
