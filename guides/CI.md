# CI 与自动更新

多仓模型下只有三类工作流，职责不重叠：

| 仓库 | 工作流 | 触发 | 作用 |
|---|---|---|---|
| 总管 `mikrotik_manual_i18n` | `sync.yml` | 每天 03:00 UTC / 手动 | ETag 探测官方站 → 变了才 `sync --update` → 提交并推送 → dispatch `pages.yml`（见下文「定时同步」） |
| 总管 `mikrotik_manual_i18n` | `pages.yml` | push `main` / 手动 / `sync.yml` 的 dispatch | `build` 构建英文站；`deploy` 过部署门禁后发布；`publish-content` 把 `CONTENT_ROOTS` 的十个内容根 + `locales.json` 推到各语种仓 |
| 语种仓（如 `mikrotik_manual_zh_hans`） | `pages.yml` | push `main` / 手动 | `translate`（读取推过来的英文正文 + 本仓 `i18n/` 覆盖层）→ `build` → 门禁 → `deploy` |

总管**不构建**任何其它语种，语种仓也**不构建**英文站；两个站点的语言下拉与
hreflang 通过 `locales.json` 里各自的绝对地址互相指向（见
[ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md)）。

## 总管：build + publish

`pages.yml` 有三个 job：

| job | 依赖 | 条件 | 说明 |
|---|---|---|---|
| `build` | — | 非 `publish_only` 的手动运行 | `npm ci` → `npm run build`（`SITE_LOCALE=en`、`ASSET_HOST=true`）→ `npm run verify:deploy` → 上传 Pages artifact |
| `deploy` | `build` | `build` 成功 | `actions/deploy-pages` |
| `publish-content` | `build`（`always()`） | push `main`，或手动勾选 `publish_only` | `locales:check` → 检查 `CROSS_REPO_TOKEN` → `node tools/content/publish.mjs` |

`publish-content` 与本仓构建**解耦**：push `main` 时即使 `build` 失败也会执行
（英文站上线失败不应阻断语种站拿到修正后的正文）；只想重推内容时用手动触发的
`publish_only`，`build`/`deploy` 会跳过，省掉 13–14 分钟构建。语种仓自己的
`build` 是第二道门禁：内容有问题它就不会部署。

每个非 default 语种：clone → 用总管的内容根整体替换目标树（目录）
/ 覆盖写（`sidebars.ts`、`sidebars-hardware.ts`、`versions.json`）→ 写
`locales.json` → 断言 `.gitignore` 没有忽略任一根（有则**提交前**失败并打印具体规则）
→ 只有 `git status --porcelain` 非空才 commit → push。push 触发语种仓的
`pages.yml`。内容根清单（`CONTENT_ROOTS`）：`docs/`、`versioned_docs/`、
`hardware/`、`blog/`、`changelog/`、`data/`、`sidebars.ts`、
`sidebars-hardware.ts`、`versioned_sidebars/`、`versions.json`；`static/` 不在其中
（资源由英文站提供）。令牌是 fine-grained PAT，存在**总管仓**的 Actions secret
`CROSS_REPO_TOKEN`，不受本仓 `permissions: contents: read` 限制；缺失时 job
明确失败并给出配置步骤，不会静默跳过。

## 定时同步（`sync.yml`）

总管仓每天 03:00 UTC（11:00 Asia/Shanghai）自己去看官方站有没有更新，**有才抓**：

| 步骤 | 做什么 | 说明 |
|---|---|---|
| probe | `node tools/sync/index.mjs --probe` | 读 `/llms.txt` 拿官方当前 release，再对 `/llms-full.txt` 发一次带 `If-None-Match` 的条件 GET（ETag 记在 `upstream/<version>/manifest.json` 的 `corpus_etag`） |
| 命中 | 退出码 `0` | 官方语料与清单一致：不发页面请求、不写文件、不提交，整次运行 1–2 分钟（大头是 `npm ci`） |
| 未命中 | `--update` | 版本变了或 ETag 变了，走完整流水线（fetch → snapshot → install → crawl → materialise → assets → sidebars → prune → verify） |
| 提交 | `sync: upstream update <yyyy-mm-dd>` | 只有 `git status --porcelain` 非空才提交；`reports/` 的版本-路由差异作为同步证据一起提交 |
| 构建 | dispatch `pages.yml` | 见下面的递归规则 |

退出码约定：`--probe` 的 `0` = 未变、`10` = 需要同步、`2` = 探测失败。
**探测失败不等于官方没变**：工作流把它当「需要同步」处理（fail-open），让完整
流水线自己的预检和 stage 门禁去报真正的错误。

### 官方加页面 / 删页面

同一次刷新里官方可能既加页又删页（7.26 就加了 `wireless/wifi/configuring-meshpoint`
和 `firewall-and-quality-of-service/firewall/raw`、删了 `tg-lr-setup-guide`）。两件事
都必须由流水线自己处理，否则每天都会卡在同一处：

- **加页面**：`fetch-upstream` 给官方新增、本地还没有的路由分配 `<route>.md`
  （不再以「no local path mapping」硬失败）；`cache-structure` 在 `docs/` 还没有该
  文件时用上游 Markdown 当本地文本——`materialize` 要到下一阶段才写这个文件。
- **删页面**：官方已经不返回（页面的 `source` 给出 404/410）的页面**不再**被当成
  「镜像自有页面」而收进清单；它不进清单，`prune-orphans` 随后删掉 `docs/` 里的
  副本。本仓自己写的页面靠 `corrections/local-pages/<docs_dir>/<route>.md` 记录
  保住——那是唯一的「这一页是本仓的」信号，不要手工删掉那些文件。

### 为什么是 dispatch 而不是等 push 触发

用默认 `GITHUB_TOKEN` 做的 push **不会**再触发其它工作流（GitHub 的递归规则；
`workflow_dispatch` / `repository_dispatch` 是例外）。所以同步 job 推完提交后显式
`createWorkflowDispatch('pages.yml')`，作用在该分支的最新提交上——效果与 push 触发
相同，且只构建一次。若以后改用带 hub 写权限的 PAT 做 checkout/push，请**删掉**这个
dispatch step，否则 `pages.yml` 会跑两遍（第二次被 `pages` 并发组排队，白等 14 分钟）。

### 手动触发与排查

1. Actions → **Sync upstream documentation** → *Run workflow*；
2. 想无视 ETag 强制重抓，勾 `force`（跳过探测，直接 `--update`）；
3. 本地等价命令：

```bash
node tools/sync/index.mjs --probe     # 0=未变 10=需要同步 2=探测失败
node tools/sync/index.mjs --check     # 只读；既有 3,511 条漂移是已知状态
node tools/sync/index.mjs --update    # 需要干净工作树（--allow-dirty 可跳过该守卫）
git status --porcelain                # 非空 = 这次同步真的改了东西
```

4. 失败时工作流会开一个 issue，标题 `sync failed: <run url>`，正文是失败 run 的链接
   和 `sync.log` 最后 40 行；镜像不会半更新——失败的运行**不提交**，站点保持上一版。
   修好后重跑同一个 workflow 即可，下一次 cron 也会自动重试。

### 权限与并发

- `permissions`：`contents: write`（提交）、`issues: write`（失败建 issue）、
  `actions: write`（dispatch `pages.yml`）。不需要 `CROSS_REPO_TOKEN`：语种仓由
  `pages.yml` 的 `publish-content` 负责。
- `concurrency: sync-upstream`（`cancel-in-progress: false`）：两次同步不重叠，
  否则会同时写同一棵树，后一次的 push 在 rebase 之前就被拒。
- `timeout-minutes: 120`：首次同步要抓整份语料（约 1.5k 页 + 渲染页 + 资源）；
  命中 ETag 时只有两次 HTTP 请求。

### 已知风险

- **官方改版**：`/llms.txt` 的版本行和 `/llms-full.txt` 的 ETag 是硬依赖。前者读不到
  会让 `--probe` 退出 2（fail-open → 完整流程再失败一次并开 issue）；后者消失时
  `--update` 退回逐页抓取，只是慢，不会错。
- **首次运行不是 304**：`upstream/<version>/manifest.json` 里没有 `corpus_etag` 时
  必然走完整抓取，抓完才写入 ETag；从第二次起才有「几秒结束」的效果。
- **超过 120 分钟**：流水线「首个失败即中止」，超时等价于失败——没有提交、开 issue。
  重跑会用同样的工作量再来一次，所以真遇到慢，先手动勾 `force` 跑一次把 ETag 落地。
- **不需要 Playwright**：`--update` 的 stage 全是 HTTP + cheerio（`playwright-core`
  只被 `crawl-sidebar.mjs` / `fetch-changelog.mjs` 使用，两者不在 stage 列表里），
  所以工作流不装 Chromium，省 1–2 分钟，也少一个上游依赖。若把渲染型 stage 加进
  `buildStages()`，要补 `npx playwright install --with-deps chromium`。

## 打开自动更新（GitHub 设置）

1. **Secret**（总管仓 Settings → Secrets and variables → Actions → Secrets）
   - `CROSS_REPO_TOKEN`：fine-grained PAT，Repository access 只勾语种仓，
     Permissions 只给 **Contents: Read and write**。申请、最小权限与轮换见
     [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md#7-security-model)。
2. **Variables**（可选）：`SITE_URL` / `BASE_URL` 已写在 `pages.yml` 的 workflow
   env 里，`locales.json` 也有同样的默认值；只有 fork 或预览域名不同才需要改。
3. **语种仓**：内容通过 git push 进入，所以它的每一内容根都必须被 git 跟踪
   （`.gitignore` 不能忽略 `docs/`、`versioned_docs/`、`hardware/`、`blog/`、
   `changelog/`、`data/`、`sidebars*.ts`、`versioned_sidebars/`、`versions.json`、
   `locales.json`）；它自己的 `pages.yml` 负责 translate + build + deploy。
   迁移步骤见
   [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md#9-adopting-an-existing-language-repository)。

## 首次启用建议顺序

1. 在总管仓跑一次 **Build and deploy site**，确认英文站构建与部署通过；
2. 勾选 `publish_only` 再跑一次，确认 `publish-content` 成功、语种仓出现
   `content: sync from hub <sha>` 提交并触发其工作流；
3. 观察语种仓的 translate / build / deploy 三个 job；
4. 本地复现用 `npm run content:publish:dry`（不联网）与
   `node tools/content/publish.mjs --only=<tag>`。

## 本地等价命令

```bash
npm run locales:check                            # 校验 locales.json（不联网）
npm run content:publish:dry                      # 打印发布计划（不克隆、不推送）
CROSS_REPO_TOKEN=… npm run content:publish        # 真正推送（本地需要 PAT）
SITE_LOCALE=en ASSET_HOST=true BUILD_HEAP_MB=6144 npm run build
npm run verify:deploy                            # 部署门禁：slim → 四条断言
```

`verify:assets`（`tools/verify/asset-refs.mjs`）**必须在 `build:slim` 之后跑**：
`slim` 删掉 `build/<locale>/{img,assets/images,assets/files}` 并把 URL 改回根副本，
不先瘦身它只会报「产物里还有 locale 前缀」。`npm run verify:deploy` 已经把顺序固定好，
单独跑断言时不要调换这两步。

## 部署前置：站点地址

站点地址有三层，优先级从高到低：workflow `env`（`pages.yml` 显式写的
`SITE_URL`/`BASE_URL`/`LOCALE_*`）→ `locales.json` 里该语种的 `site`/`baseUrl`
→ 代码默认值。`docusaurus.config.ts` 与 `tools/lib/site-config.mjs` 都通过
`tools/content/locales.js` 解析，所以构建、`llms.txt`、瘦身脚本和产物断言看到
的是同一组地址。

当前 `pages.yml` 在 workflow env 固定了英文站地址，不需要在 GitHub 里再建
Variables；fork 或换域名时改 workflow env（或仓库 Variables）即可。**不要**只改
`locales.json` 而忘了语种仓的 `ASSET_ORIGIN`：那会让语种站的图片、PDF 和视频
全部 404。`build` job 设了 `timeout-minutes: 45`（默认 360），`concurrency` 用
`cancel-in-progress: false`，避免新 push 取消正在进行的部署。

## 部署门禁（`pages.yml`）

`pages.yml` 在 `npm run build` 之后、`upload-pages-artifact` 之前跑
`npm run verify:deploy`（先 `slim`，再四个断言）；任何一个非 0 就停在构建阶段，
不产出 Pages 制品，上一次成功的部署继续服务：

| 步骤 | 断言内容 |
|---|---|
| `npm run verify:assets` | 产物与源 Markdown 里没有 locale 前缀资源引用、没有双哈希 PDF、没有指向不存在文件的引用 |
| `npm run verify:base-url` | 资源型根绝对引用（`img`/`video`/`link`/`og:image` 等）都在 `baseUrl` 之下 |
| `npm run verify:orphan-assets` | 站内 `/img/<file>` 引用都有对应文件 |
| `npm run verify:llms` | 产物里的每一份 `llms.txt`（站点根、各版本 `docs/<version>/`）中的站内链接都指向存在的产物文件；`llms-full.txt` 也按普通目标校验，被 `build:slim` 删掉就失败 |

`verify:llms`（`tools/verify/llms-links.mjs`）补的是别的断言看不见的一类断链：`llms.txt` 里是
绝对 URL 字符串而不是路由，`onBrokenLinks` 与浏览器检查都不会管，所以只能在瘦身后的产物上
逐条比对（也必须排在 `build:slim` 之后）。

`verify:deploy` 已经按顺序包含 `slim` 与四个断言，别再拆成两步分别跑：`slim` 必须
在断言之前（见上）。门禁与 `build` 共用同一组 `SITE_URL` / `BASE_URL`，否则
`base-url-refs` 会用 `locales.json` 的默认前缀去校验另一套产物；`slim` 也按
`BASE_URL` 重写绝对 URL，不能只靠配置文件默认值。

## Shared assets (`ASSET_ORIGIN`)

The English site is the **asset host**. A localized site no longer keeps
`static/`: images, PDFs, videos, captured pages and the CLI data stay in the
English repository, and the localized build rewrites its resource references to
that origin.

| `ASSET_ORIGIN` | Behaviour |
| --- | --- |
| unset (English site) | every root-absolute reference gets the local `baseUrl` — unchanged behaviour |
| set (localized sites) | `/img/`, `/assets/`, `/videos/`, `/official/`, `/cli/` become `${ASSET_ORIGIN}/…`; page routes (`/docs/`, `/hardware/`, `/blog/`, `/changelog/`) stay local |

The value is the English **site base address**, not a bare origin: include the
base path and omit the trailing slash
(`https://newwlfz.github.io/mikrotik_manual_i18n`). It is set in the Chinese
repository's `pages.yml`; the English build does not set it.

Where the rewrite happens (the code is byte-identical in both repositories):

- `tools/build/remark-prefix-root-refs.mjs` — raw HTML/JSX attributes *and*
  Markdown image/link destinations. It is also registered in
  `beforeDefaultRemarkPlugins`, otherwise `transformImage` would `require()`
  `![](/img/…)` as a local file and a localized build without `static/` would
  fail.
- `customFields.assetBaseUrl = ASSET_ORIGIN || baseUrl` — `<Img>`, the navbar
  logo, the favicon and `og:image`.
- `tools/build/llms.mjs` — `llms-full.txt` and the generated per-page `.md`
  copies.
- `staticDirectories: []` — a leftover `static/` is **ignored** (the build
  prints a warning), never published.
- `tools/cli/build-all.mjs` — the generated CLI data (~7 MiB) is written to
  `work/cli/` instead of `static/cli/`, so a localized build never recreates
  the tree. `cli-compare.json` is still published at the local site root: it is
  read with `fetch()`, which needs CORS, and the asset host sends no
  `Access-Control-Allow-Origin`.
- `tools/verify/asset-refs.mjs` counts external references and skips local
  existence checks for them; `tools/verify/orphan-assets.mjs` skips the orphan
  scan when `static/img` is absent; `tools/build/slim.mjs` prints
  `external assets: N refs` instead of pruning.

Still deployed locally: the pagefind index (`customFields.localAssetBaseUrl`),
Webpack chunks/fonts and the per-page `docs/**/img` images.

### The hub must keep its full `/img` tree (`ASSET_HOST`)

The English site is not only a reader-facing site, it is also the **host of the
localized sites' assets**, so its deploy shape has one extra requirement:
`ASSET_HOST=true` (set in this repository's `pages.yml`) makes `slim` keep the
complete `build/img` tree (~99 MiB). Without it, `slim` prunes every `/img/<name>`
that no *English* page requests — and English Markdown images are served from
`assets/images`, so almost all of `/img` would be pruned while localized pages
load exactly those `/img/<name>` URLs (404).

The extra ~88 MiB is the price of sharing; the Pages site stays under the 1 GB
budget today. A dedicated asset CDN later would keep the full `static/` tree and
drop this constraint.

**Failure risk.** `ASSET_ORIGIN` couples every localized site to the English
site's URL. Renaming the repository, moving to another domain or changing its
base path breaks images, PDFs and videos on *all* localized sites at once. Any
such move must update `ASSET_ORIGIN` in every localized repository's `pages.yml`
in the same change. A dedicated CDN later needs no code change: point
`ASSET_ORIGIN` at it and copy the `static/` tree there.

Local verification (English assets on port 3020 under
`/mikrotik_manual_i18n/`, localized build on 3021):

```bash
# English repository: serve build/ so /mikrotik_manual_i18n/... resolves
# (any static server rooted one level above build/ works)
# Localized repository: build against it, then run the deploy gate
ASSET_ORIGIN=http://127.0.0.1:3020/mikrotik_manual_i18n \
SITE_URL=http://127.0.0.1:3021 BASE_URL=/mikrotik_manual_zh_hans/ \
SITE_LOCALE=zh-Hans npm run build
ASSET_ORIGIN=http://127.0.0.1:3020/mikrotik_manual_i18n npm run verify:deploy
```

`verify:deploy` must exit 0 with external references: they are counted, not
checked against `build/`.

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

## `script_warning` in a language repo's job summary

The language repositories check every translation against the target locale's
writing system before it is written (`tools/translate/lib/script-check.mjs`):
`zh-Hant` must not contain Simplified-only characters or mainland terms,
`zh-Hans` is checked in the opposite direction. A hit gets one feedback retry
with the offending forms quoted back; an answer that still fails is kept and
recorded as `script_warning`.

The warning never gates the build — the page is written, committed and deployed
as usual — but it is not silent either:

- the `--json` batch summary carries `script_warning` (count) and
  `script_warnings` (per item `file` / `kind` / `forms` / `sample`);
- `work/translate/run.json` keeps the same records, so the next batch can see
  what the previous one left behind;
- `tools/ci/read-translate-summary.mjs` writes `script_warning=<count>` as a step
  output and lists one row per warning under the batch table in the job summary.
