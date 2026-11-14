# CI 与自动更新

多仓模型下只有两类工作流，职责不重叠：

| 仓库 | 工作流 | 触发 | 作用 |
|---|---|---|---|
| 总管 `mikrotik_manual_i18n` | `pages.yml` | push `main` / 手动 | `build` 构建英文站；`deploy` 过部署门禁后发布；`publish-content` 把 `docs/` + `locales.json` 推到各语种仓 |
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

每个非 default 语种：clone → 替换 `docs/` → 写 `locales.json` → 只有
`git status --porcelain` 非空才 commit → push。push 触发语种仓的 `pages.yml`。
令牌是 fine-grained PAT，存在**总管仓**的 Actions secret `CROSS_REPO_TOKEN`，
不受本仓 `permissions: contents: read` 限制；缺失时 job 明确失败并给出配置步骤，
不会静默跳过。

## 打开自动更新（GitHub 设置）

1. **Secret**（总管仓 Settings → Secrets and variables → Actions → Secrets）
   - `CROSS_REPO_TOKEN`：fine-grained PAT，Repository access 只勾语种仓，
     Permissions 只给 **Contents: Read and write**。申请、最小权限与轮换见
     [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md#7-security-model)。
2. **Variables**（可选）：`SITE_URL` / `BASE_URL` 已写在 `pages.yml` 的 workflow
   env 里，`locales.json` 也有同样的默认值；只有 fork 或预览域名不同才需要改。
3. **语种仓**：内容通过 git push 进入，所以它的 `docs/` 必须被 git 跟踪；
   它自己的 `pages.yml` 负责 translate + build + deploy。迁移步骤见
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
