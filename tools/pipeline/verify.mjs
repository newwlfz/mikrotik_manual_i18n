#!/usr/bin/env node
/**
 * Pipeline entry point: every invariant in one command.
 *
 * A fix is only "landed" when an assertion here proves it, so this is the list
 * of what the mirror promises: table coverage, CLI tables, sidebar/label policy,
 * static image references, PDF attachments, and the browser checks.
 *
 * The overlay structure check (`translate:verify`) is not here: this repository
 * publishes English only, and the translation toolchain lives in
 * `templates/locale-repo/tools/` (see `tools/README.md`).
 *
 *   node tools/pipeline/verify.mjs           # non-browser checks
 *   node tools/pipeline/verify.mjs --browser # + Chrome assertions (needs build/)
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const steps = [
  // 产物门禁（hardware/blog/changelog 现由 fetch-* stage 抓取并写入 manifest）：
  // 三区缺失或与 manifest.generated_at 不一致时，必须在任何其它步骤之前
  // fail-closed，和 lock:check / verify:cold-start 一样把 exit code 并入下面的
  // failed/ok 计算；修复方式是重跑抓取 stage，不是从 HEAD checkout。
  ['npm', ['run', 'verify:build-inputs']],
  // favicon 溯源门禁：headTags 指向 static/img/favicon.svg，本地字节必须与
  // data/manifests/favicon.json 的 sha256/bytes 一致（manifest 不存在时 SKIP）。
  ['npm', ['run', 'verify:favicon']],
  // 仓库级结构门禁（不需要 build/、不需要联网，必须最早跑）：锁文件完整性先于
  // 任何依赖使用；冷启动 first-install 契约保证 sync 的 stage 表和 probe 约定
  // 没有回归。两条脚本各自的 exit code 都并入下面的 failed/ok 计算。
  ['npm', ['run', 'lock:check']],
  ['npm', ['run', 'verify:cold-start']],
  // 图片寻址前置断言：materialize 从官方 .md 重建页面时会丢掉 HEAD 里的
  // /img/<hash> 引用；在 54 分钟的网络级 assets 阶段之前只 fail-closed 校验
  // 仍被寻址的 /img/<hash> 有 blob。相对 ./img/<name> 在冷启动必然没有页内
  // 副本，交由 assets 抓取、address-images 寻址，这里仅计数、不判失败。
  ['npm', ['run', 'verify:addressing-ready']],
  // 显式检查点断言：schema/stopped/limit、deadline-elapsed >= 0、run.json /
  // state / shards 存在、TM 条目非递减、llm + tm == translated。没有检查点
  // （全新模板仓）时脚本 SKIP，不会误报失败。
  ['node', ['tools/verify/checkpoint.mjs']],
  // 围栏着色覆盖：未着色围栏里「疑似 RouterOS」的比例必须低于阈值，
  // 否则中文页会出现英文页高亮、中文页黑字的退化。
  ['npm', ['run', 'verify:fences']],
  ['npm', ['run', 'verify:tables:check']],
  // 表格链接锚点保真度：确认表格内的页内锚点没有被后续 stage 改写丢失。
  ['npm', ['run', 'verify:anchor-fidelity']],
  // 归档保真度门禁：不联网，断言每个归档版本的渲染结构缓存、表格单元格列表、
  // pagination_prev: null、逐版本 tags 元数据/manifest/Markdown 对齐（DNS canary
  // 7.24=3、7.25=4）以及三版 CLI 互链索引与构建 HTML 一致。build/ 存在时同时
  // 断言归档页的 theme-doc-footer-tags-row 与 rel=tag 数量，否则该项 SKIP。
  ['npm', ['run', 'verify:archive-fidelity']],
  // 来源时间门禁：docs / 各归档版本 / blog / changelog / hardware 五类页面
  // 凡有 source 必须有 captured_at，且与对应抓取 manifest 的 generated_at 一致；
  // 三区 manifest 尚未落盘时该类记 SKIP。修复 materialize 抹掉 captured_at 后
  // 这一步是唯一能证明「四类页面都带本次抓取时间」的静态断言。
  ['npm', ['run', 'verify:provenance']],
  ['npm', ['run', 'verify:cli']],
  ['npm', ['run', 'verify:labels']],
  ['npm', ['run', 'verify:sidebar']],
  ['npm', ['run', 'verify:orphan-assets']],
  // 构建产物断言：需要 build/，和 asset 检查放在一起。
  ['npm', ['run', 'verify:base-url']],
  // 定点断言：blog/hardware 页的 Markdown 图片不能被裸 /img/ 引用漏掉前缀
  // （asset-refs / orphan-assets 只看文件存在，挡不住部署后的 404）。
  ['npm', ['run', 'verify:build-image-prefix']],
  // llms.txt 里的站内绝对链接（含 llms-full.txt）必须指向真实产物；
  // 在 `build:slim` 之后跑，断言的是部署形态。
  ['npm', ['run', 'verify:llms']],
  // changelog tags 门禁：数据面断言每篇 changelog/*.md 都带
  // permalink=changelog 的 tags，构建面断言 /changelog/tags/changelog 已产出；
  // 排在 build:slim 之后，build/changelog 缺失时构建面 SKIP。
  ['npm', ['run', 'verify:changelog-tags']],
  // Tag-row duplication gate: the sync pipeline must not convert the official
  // article's own "Tags" block into Markdown. Source face asserts zero body
  // `**Tags:**` rows and one front-matter `tags:` block per blog/changelog page;
  // build face (after build:slim) asserts the native footer is the only one.
  ['npm', ['run', 'verify:tag-rows']],
  // Hardware structural fidelity: Quick Guides category, lead dedup,
  // unquoted breadcrumb and Next link parity (offline; --online for official).
  ['node', ['tools/verify/hardware-fidelity.mjs']],
  // 官方 PDF 下载提示门禁：fetch-hardware 从渲染页恢复的 PDF 提示必须仍在
  // committed 的 hardware Markdown 里（离线 --check，不联网、不读 PDF 二进制）。
  ['npm', ['run', 'verify:pdf-notice']],
  // 跨仓一致性门禁（hub 为唯一事实源）：三仓 locales.json / sidebars-hardware.ts
  // 必须逐字节一致，各仓 build meta 的 available-locales 必须与本仓 locales.json
  // 派生一致，EXPECTED_SYNC_LIST 每项都必须存在。registry/结构漂移或尚未重建的
  // build 产物都在这里 fail-closed；修复方式是重跑 fan-out + 重建，不是改断言。
  // 规格见 guides/FANOUT.md。
  ['node', ['tools/content/fanout-check.mjs', '--check']],
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
