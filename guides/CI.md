# CI 与自动更新

仓库已有四个工作流：

| 工作流 | 触发 | 作用 |
|---|---|---|
| `ci.yml` | PR / push 到 `main` / 手动 | 译文自测、结构校验、表格、CLI、标签、侧边栏、构建 |
| `pages.yml` | push 到 `main` / 手动 | 构建、瘦身、**部署门禁**，通过后部署到 GitHub Pages |
| `sync.yml` | 每日 03:17 / 手动 | 跟随官方站、剪枝、构建、提交（需 `ENABLE_SYNC=true`） |
| `translate.yml` | 每周一 04:37 / 手动 | 翻译待处理块、校验、构建、提交（需 `ENABLE_TRANSLATION=true` + `LLM_*`，见 [LLM.md](LLM.md)） |

## 打开自动更新（仓库设置，两步）

1. **Variables**（Settings → Secrets and variables → Actions → Variables）
   - `ENABLE_SYNC` = `true`
   - `ENABLE_TRANSLATION` = `true`
   - `SITE_URL` / `BASE_URL`：部署地址（Pages 的域名）
   - `LLM_BASE_URL` / `LLM_MODEL`：翻译接口与模型（见 [LLM.md](LLM.md)）
2. **Secrets**（同一页面的 Secrets）
   - `LLM_API_KEY`：翻译服务的 key（旧名 `OPENCODE_API_KEY` 已弃用，请改名）

## 首次启用建议顺序

1. Actions → **Sync official content** → `Run workflow`（不勾 force），确认能跑完并 commit；
2. Actions → **Translate zh-Hans** → `Run workflow`，`limit` 先填 `50` 试水，通过后再让定时任务跑；
3. 观察一两天：`sync.yml` 每日只应在官方有变化时产生提交；
4. 若失败，先看 stage 名（日志里的 `=== <stage>`），本地用
   `node tools/pipeline/sync.mjs --update --dry-run` 复现。

## 本地等价命令

```bash
node tools/pipeline/sync.mjs --update --dry-run   # 预演，不改文件
node tools/pipeline/translate.mjs                 # 重建译文
node tools/pipeline/build.mjs                     # 构建：CLI → Docusaurus → Pagefind（10 GiB 堆）
node tools/pipeline/verify.mjs --browser          # 全部断言（需先 build）
npm run verify:deploy                             # 部署前门禁：先 build:slim，再 asset-refs / base-url / orphan-assets / llms-links
```

`verify:assets`（`tools/verify/asset-refs.mjs`）**必须在 `build:slim` 之后跑**：
`slim` 删掉 `build/<locale>/{img,assets/images,assets/files}` 并把 URL 改回根副本，
不先瘦身它只会报「产物里还有 locale 前缀」。`npm run verify:deploy` 已经把顺序固定好，
单独跑断言时不要调换这两步。

## 部署前置：仓库 Variables 必须设置

`pages.yml` 的 `build` job 在 `npm ci` 之前有一步 `Validate site variables`（该 job
的第一个 `run` 步骤，紧跟 checkout 与 setup-node），它检查
`vars.SITE_URL` / `vars.BASE_URL`：任一个为空，或者 `SITE_URL` 还带着
`mirror.invalid` 占位符，就直接 exit 1，CI 立刻失败。这比让构建跑十几分钟再产出一套
URL 全错的产物要划算——`build` 会用 `SITE_URL` 生成 canonical / `og:url` / sitemap，
缺值或占位值不会报错，只会把整站指向错域名。

设置位置：仓库 **Settings → Secrets and variables → Actions → Variables**，两个都要
Repository variable（不是 Environment variable）：

```text
SITE_URL = https://newwlfz.github.io
BASE_URL = /mikrotik_manual_i18n/
```

`SITE_URL` 是 origin（不带尾斜杠、不带仓库路径），`BASE_URL` 是站点子路径（必须带
首尾斜杠）。该 job 只在 push `main` 与 `workflow_dispatch` 时跑，本地和 PR 上变量为空
不受影响。另外 `build` job 设了 `timeout-minutes: 45`（默认 360），`concurrency` 用
`cancel-in-progress: false`，避免新 push 取消正在进行的部署。

## 部署门禁（`pages.yml`）

`pages.yml` 在 `npm run build` → `npm run build:slim` 之后、`upload-pages-artifact`
之前跑四个断言；任何一个非 0 就停在构建阶段，不产出 Pages 制品：

| 步骤 | 断言内容 |
|---|---|
| `npm run verify:assets` | 产物与源 Markdown 里没有 locale 前缀资源引用、没有双哈希 PDF、没有指向不存在文件的引用 |
| `npm run verify:base-url` | 资源型根绝对引用（`img`/`video`/`link`/`og:image` 等）都在 `baseUrl` 之下 |
| `npm run verify:orphan-assets` | 站内 `/img/<file>` 引用都有对应文件 |
| `npm run verify:llms` | 6 份 `llms.txt`（默认语种根、`zh-Hans/`、`docs/7.24` 与 `docs/7.25` 及其 `zh-Hans` 副本）里的 8,668 条站内链接都指向存在的产物文件；`llms-full.txt` 也按普通目标校验，被 `build:slim` 删掉就失败 |

`verify:llms`（`tools/verify/llms-links.mjs`）补的是别的断言看不见的一类断链：`llms.txt` 里是
绝对 URL 字符串而不是路由，`onBrokenLinks` 与浏览器检查都不会管，所以只能在瘦身后的产物上
逐条比对（也必须排在 `build:slim` 之后）。

CI 里用这四条而不是 `npm run verify:deploy`，因为 `build:slim` 刚跑过，`verify:deploy`
会在断言前再瘦一次（幂等，但多花一遍全量扫描）；本地没有瘦身产物时用 `verify:deploy`
一步到位。门禁步骤与 `build` 步骤共用 `SITE_URL` / `BASE_URL`，否则 `base-url-refs`
会用 `docusaurus.config.ts` 的默认前缀去校验另一套产物。`build:slim` 也吃 `BASE_URL`
（它按这个前缀重写产物里的绝对 URL），所以这一步同样显式传入，不能只靠配置文件的默认值。

## 发布彩排（本地，不 push）

`pages.yml` 只有 push 之后才会跑，但它的每一步都能在本地原样复现。
`tools/build/rehearse-pages.mjs` 按 `pages.yml` 的顺序跑构建 → 瘦身 → 四条门禁，
再按 `actions/upload-pages-artifact@v3` 的方式打包（`tar --dereference
--hard-dereference`），最后起一个按 `baseUrl` 服务的静态服务器抽查 URL，
并把全部数字写进 `work/pages-rehearsal.json`（`work/` 已被 `.gitignore` 忽略，不入库）。

```bash
# 全流程：构建 + 瘦身 + 门禁 + 打包 + URL 抽查 + browser-check
SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_i18n/ \
  node tools/build/rehearse-pages.mjs

# 复用现有 build：只重量 tar/gzip、抽查 URL、跑浏览器检查
node tools/build/rehearse-pages.mjs --skip-build

# 没有 Chrome（vendor/browsers）时跳过最后一步
node tools/build/rehearse-pages.mjs --skip-browser
```

一次成功的彩排应当看到（下面是 commit `11cf24f1d`、2026-11-14 的实测值）：

| 项 | 期望 |
|---|---|
| `build:lowmem` | exit 0，约 13–14 分钟（6 GiB 堆） |
| `build:slim` | exit 0，约 10 秒 |
| 四条门禁 | 全部 exit 0（合计约 18 秒） |
| `du -sb build` | ≈ 1.15 GB（1.07 GiB） |
| tar（artifact 口径） | ≈ 1.19 GB（1.11 GiB），远低于 10 GB |
| `gzip -9` 体积 | ≈ 364 MB（347 MiB），只作上传参考 |
| 文件 / 目录 | ≈ 47,900 文件 / 12,400 目录 / 0 符号链接 |
| 抽查 URL | 13 条全部 200，且 `content-length` 与磁盘文件一致 |
| `node tools/verify/browser-check.mjs` | 29/29 |

tar 比 `du -sb` 大约 4,200 万字节，是 tar 的 512 字节块填充与目录项开销，不是产物变多。

### 本地彩排不能替代真实部署

- 本机用 `build:lowmem`（6 GiB 堆），`pages.yml` 用 `npm run build` +
  `NODE_OPTIONS=--max-old-space-size=10240`。两者产物相同，**构建耗时不可直接类比**
  （本机 15 GiB 内存，10 GiB 堆会 OOM）。
- 没有跑 `npm ci`：用的是工作区已有的 `node_modules`。依赖树是否与
  `package-lock.json` 完全一致，只有真实 CI 能确认。
- 静态服务器只模拟 `baseUrl` 下的路径解析（`/`、`index.html`、`.html` 回退、404），
  不模拟 CDN、压缩、HTTP/2 与 Pages 的 404 回退细节。
- **1 GB 的 “published site” 上限是否硬性拒绝，本地无法证明。** GitHub 文档把它写成
  发布站点的上限（[GitHub Pages 限制](https://docs.github.com/zh/pages/getting-started-with-github-pages/github-pages-limits)），
  但上传侧只受 10 GB artifact 限制；超限究竟是拒绝部署、部分 404，还是仅告警，
  只有一次真实部署能定论。
- 仓库 Variables（`SITE_URL` / `BASE_URL`）是否已经设置，本地看不到。两者未设置时
  构建会退回 `docusaurus.config.ts` 的 `https://mirror.invalid`，而四条门禁仍然全绿
  ——门禁只校验内部一致性，不校验域名是不是真的。

如果真实部署因为体积被拒，回退顺序（数字以彩排实测为准）：

1. 去掉一个归档版本（7.24 约 226 MiB → 剩约 872 MiB）；
2. 只留当前 7.26（去掉 7.24 + 7.25 → 约 642 MiB）；
3. 中英文拆成两个 Pages 站点（英文约 640 MiB、中文约 457 MiB）。

Pages 发布失败时会保留上一次成功的部署，站点不会因为一次超限立刻下线；
但新内容也就不会上线，所以体积问题要在合并前解决，而不是等部署时报错。

PDF 附件链接一律写成裸 HTML 锚点
（`<a href="/assets/files/<name>.pdf" target="_blank" rel="noopener">…</a>`）：
Markdown 链接会被 `mdx-loader` 的 `transformLinks` 改写成 `require()`，再由
`otherAssets` 加载器给已经带内容哈希的文件名**再加一个哈希**
（`<stem>-<sha>-<sha>.pdf`），产物因此翻倍（约 60 MB）。锚点不经过 `transformLinks`，
`href` 的 `baseUrl` 由 `tools/build/remark-prefix-root-refs.mjs` 补；转换由
`tools/sync/sync-pdfs.mjs` 与 `tools/translate/fix-asset-links.mjs` 调用
`tools/translate/lib/pdf-links.mjs` 完成，两者都是幂等的。
