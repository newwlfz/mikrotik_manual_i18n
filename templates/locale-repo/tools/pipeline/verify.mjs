#!/usr/bin/env node
/**
 * Pipeline entry point: every invariant in one command.
 *
 * A fix is only "landed" when an assertion here proves it, so this is the list
 * of what the mirror promises: translation structure, table coverage, CLI
 * tables, sidebar/label policy, static image references, PDF attachments, and
 * the browser checks.
 *
 *   node tools/pipeline/verify.mjs           # non-browser checks
 *   node tools/pipeline/verify.mjs --browser # + Chrome assertions (needs build/)
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const steps = [
  ['npm', ['run', 'translate:selftest']],
  ['npm', ['run', 'translate:verify']],
  // 围栏着色覆盖：未着色围栏里「疑似 RouterOS」的比例必须低于阈值，
  // 否则中文页会出现英文页高亮、中文页黑字的退化。
  ['npm', ['run', 'verify:fences']],
  ['npm', ['run', 'verify:tables:check']],
  ['npm', ['run', 'verify:cli']],
  ['npm', ['run', 'verify:labels']],
  ['npm', ['run', 'verify:sidebar']],
  ['npm', ['run', 'verify:orphan-assets']],
  // 构建产物断言：需要 build/，和 asset 检查放在一起。
  ['npm', ['run', 'verify:base-url']],
  // llms.txt 里的站内绝对链接（含 llms-full.txt）必须指向真实产物；
  // 在 `build:slim` 之后跑，断言的是部署形态。
  ['npm', ['run', 'verify:llms']],
];
if (process.argv.includes('--browser')) steps.push(['node', ['tools/verify/browser-check.mjs']]);

let failed = 0;
for (const [command, args] of steps) {
  const result = spawnSync(command, args, {cwd: REPO, stdio: 'inherit'});
  if (result.status !== 0) {
    failed++;
    console.error(`FAILED: ${command} ${args.join(' ')}`);
  }
}
process.exit(failed ? 1 : 0);
