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
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEAP_MB = Number(process.env.BUILD_HEAP_MB || 10240);
const current = process.env.NODE_OPTIONS || '';
const nodeOptions = /--max-old-space-size=/.test(current)
  ? current
  : `${current} --max-old-space-size=${HEAP_MB}`.trim();

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
