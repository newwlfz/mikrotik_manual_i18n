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
  // 仓库级结构门禁：锁文件完整性先于任何依赖使用（与 hub 一致）。
  // 断言 package-lock.json 覆盖 pagefind 声明的全部平台包，缺一即 fail-closed。
  ['npm', ['run', 'lock:check']],
  ['npm', ['run', 'translate:selftest']],
  ['npm', ['run', 'translate:verify']],
  // 显式检查点断言：schema/stopped/limit、deadline-elapsed >= 0、run.json /
  // state / shards 存在、TM 条目非递减、llm + tm == translated。没有检查点
  // （全新模板仓）时脚本 SKIP，不会误报失败。
  ['node', ['tools/verify/checkpoint.mjs']],
  // 围栏着色覆盖：未着色围栏里「疑似 RouterOS」的比例必须低于阈值，
  // 否则中文页会出现英文页高亮、中文页黑字的退化。
  ['npm', ['run', 'verify:fences']],
  ['npm', ['run', 'verify:tables:check']],
  ['npm', ['run', 'verify:cli']],
  ['npm', ['run', 'verify:labels']],
  ['npm', ['run', 'verify:product-names']],
  ['npm', ['run', 'verify:sidebar']],
  ['npm', ['run', 'verify:orphan-assets']],
  // 构建产物断言：需要 build/，和 asset 检查放在一起。
  ['npm', ['run', 'verify:base-url']],
  // llms.txt 里的站内绝对链接（含 llms-full.txt）必须指向真实产物；
  // 在 `build:slim` 之后跑，断言的是部署形态。
  ['npm', ['run', 'verify:llms']],
  // changelog tags 门禁：数据面断言每篇 changelog/*.md 都带
  // permalink=changelog 的 tags，构建面断言 /changelog/tags/changelog 已产出；
  // 排在 build:slim 之后，build/changelog 缺失时构建面 SKIP。
  ['npm', ['run', 'verify:changelog-tags']],
  // Tag-row duplication gate: source face asserts zero body `**Tags:**` rows and
  // exactly one front-matter `tags:` block per article; build face (when build/
  // exists) asserts the native footer is the only one. SKIPs on a locale repo
  // with no committed blog/changelog content.
  ['npm', ['run', 'verify:tag-rows']],
  // Hardware structural fidelity: Quick Guides category, lead dedup,
  // unquoted breadcrumb and Next link parity (offline; --online for official).
  ['node', ['tools/verify/hardware-fidelity.mjs']],
  // 官方 PDF 下载提示门禁：fetch-hardware 从渲染页恢复的 PDF 提示必须仍在
  // committed 的 hardware Markdown 里（离线 --check，不联网、不读 PDF 二进制）。
  ['npm', ['run', 'verify:pdf-notice']],
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
