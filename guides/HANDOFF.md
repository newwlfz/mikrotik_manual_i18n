# 交接文档（HANDOFF）

> **本仓已拆分为英文站仓库（2026-11-14）。** 下文是从「中英双语同仓」时期冻结
> 基线的交接快照，只保留作历史参考：其中的 `i18n/`、`build/zh-Hans/`、
> 双语构建耗时、`state/translation-state.json` 等都不属于本仓。当前口径以
> [`README.md`](../README.md) 为准：本仓只构建 `en`（`SITE_LOCALE=en`），
> 中文站是另一个仓库，本仓仅提供跨仓语言入口（`LOCALE_ZH_URL` /
> `LOCALE_ZH_BASE_URL`）。数字与命令若与 `README.md` 冲突，以 `README.md` 为准。

> 给「下一个接手的会话」看的现状说明。文中每个数字都在 2026-11-12 本地实测过，
> 复核命令在 §2 与 §6 里；数对不上时先查原因，不要照着改文档。

## 1. 一句话

`manual.mikrotik.com`（MikroTik RouterOS 官方手册）的中英双语镜像站：Docusaurus 3.10.1
静态站，当前版 **7.26** 加归档 **7.25 / 7.24** 三棵树，英文是抓取来的原文、`i18n/zh-Hans/`
是全量中文 overlay；`docs/`、`versioned_docs/`、`i18n/`、`sidebars.ts`、`versioned_sidebars/`
全部是管线产物，不手改。**当前状态：本地调试完成、断言与构建全绿；改动都在本地 `main`，
领先 `origin/main` 21 个提交（本文初稿提交后为 20），尚未 push。**

## 2. 现状数字

| 项 | 值 | 复核命令（在 `repo/` 下） |
|---|---|---|
| 当前版本 | `7.26` | `cat data/manifests/current-version.json` |
| 归档版本 | `7.25`、`7.24` | `cat versions.json` |
| 页面数 `docs/` | 1484 | `find docs -name '*.md' \| wc -l` |
| 页面数 `versioned_docs/version-7.25` | 1427 | `find versioned_docs/version-7.25 -name '*.md' \| wc -l` |
| 页面数 `versioned_docs/version-7.24` | 1420 | 同上换版本号 |
| 页面数 `hardware/` / `blog/` / `changelog/` | 250 / 6 / 108 | `find <dir> -name '*.md' \| wc -l` |
| 语种 | `en`（默认）+ `zh-Hans`，共 2 个 | `node -e "import('./tools/lib/site-config.mjs').then(m=>console.log(m.resolveLocales()))"` |
| `i18n/` 译文页 | 4695 = docs 4331 + hardware 250 + blog 6 + changelog 108 | `find i18n -name '*.md' \| wc -l` |
| `static/img` | 1695 个文件，95.18 MiB（99,801,808 字节） | `ls static/img \| wc -l`、`du -sb static/img` |
| `.git` | 约 172 MiB（pack 159.11 MiB + loose 约 13.1 MiB；loose 随提交数变化） | `git count-objects -vH` |
| 构建（6 GiB 堆） | 645 秒（10 分 45 秒），产出 12,168 个 HTML；构建后 `build/` 1.6G（zh-Hans 一份 768M；slim 后 1.2G） | `time npm run build:lowmem` |
| `build:slim` | 11 秒：改写 6,085 个文件里的 40,268 处 URL，删 1,504 个无引用 blob（89,423,327 B）与 6 份 `llms-full.txt`（31,022,711 B）；结果 47,901 个文件 / 1,110,747,914 字节（约 1.03 GiB，`du -sh` 1.2G） | `npm run build:slim` 的 JSON 输出、`find build -type f \| wc -l` |
| 领先远端 | 21 个提交（`main` → `origin/main`；本文初稿提交后 20） | `git rev-list --count origin/main..HEAD` |
| 工作区 | 提交后干净（本次提交只改本文；上一提交 = 本文初稿 + `reports/SESSION-PROMPT.md` 的取代横幅） | `git status --short` |

645 秒是本机 4 核 / 15 GiB / 无 swap 上跑 `npm run build:lowmem`（6 GiB 堆）的墙钟时间，
包含 `cli:build` → Docusaurus（两语种、三版本）→ Pagefind → `llms.mjs` 四步；`build:slim`
另计 11 秒，`verify:deploy` 五步合计约 25 秒（其中 llms 链接扫描 0.4 秒；本次复跑 23 秒）。不同机器差很多，只把耗时当量级参考。

## 3. 目录与事实源

| 路径 | 是什么 | 谁写 / 能不能手改 |
|---|---|---|
| `upstream/<version>/` | 官方快照：`manifest.json`（页面清单 / 哈希 / 标题 / 标签）、`structure/pages/*.json`（渲染后的表格结构，含 `<colgroup>` 槽位） | `fetch-upstream`、`cache-structure` 写；**只读**，永不手改 |
| `corrections/` | 人工修正层，`global.yml`（链接策略、表格恢复、注释样式）+ `pages/<section>/<version>/<page>.yml`（每份必须写 `source_sha256`）+ `local-pages/`（镜像自有页面） | 人写，`materialize` 读取并应用；这是唯一该手写内容的地方 |
| `docs/`、`versioned_docs/` | 英文正文，物料化产物 | `materialize` 写；不手改 |
| `i18n/zh-Hans/` | 中文 overlay，按 plugin/section 分槽（docs 有 `current`、`version-7.25`、`version-7.24`） | `translate` 写；不手改 |
| `sidebars.ts`、`versioned_sidebars/` | 侧边栏产物（当前版 + 每个归档版一份 JSON） | `sync-sidebars`（内部调 `build-sidebars`）写；不手改 |
| `sidebars-hardware.ts` | 硬件侧边栏；文件头声明由 `pipeline/gen_hardware_sidebar.py` 生成，那个脚本不在 `tools/` 里，**现有 stage 没有一个会重写它** | 改硬件目录结构时要手动同步，否则 `verify:sidebar` 只查 docs 侧 |
| `static/img/` | 全站图片的唯一来源，文件名就是内容哈希（§5.2） | `address-images` 写 |
| `static/assets/` | 官方附件（PDF、rsc、ovpn…）与被抓下来的独立 HTML 页 | `sync-pdfs` 等写 |
| `data/manifests/` | 官方清单：`docs-<v>-{sidebar,nav,metadata,categories,mermaid,inline-colors}.json`、`cli-links*.json`、`current-version.json` | 抓取/元数据 stage 写；`current-version.json` 是版本唯一事实源 |
| `versions.json` | 归档版本列表（Docusaurus 原生） | `snapshot-version` / `install-version` 写 |
| `state/` | 提交进仓库的哈希状态：`sync_state.json`（源页哈希）、`translation-state.json`（每页模式与命中数）；`update-run.json` 被 `.gitignore` 忽略 | 各 stage 写 |
| `work/translate/` | 译文记忆：`model-memory.json`（块记忆）、`tm-global.zh-Hans.json`、`table-memory.json`、`comment-memory.json`、`legacy-index.json` | `harvest` / `translate` 写；**在仓库外**（`../work/translate/`），不入库，删了就丢译文 |
| `work/`（仓库内） | 本地临时日志与 `--json` 转储，已被 `.gitignore` | 随手写 |
| `config/` | 人写的开关与词表，顶层键见下表 | 人写 |
| `reports/` | 历史报告与取证；一次性报告在 `reports/archive/` | 人写 |

`config/` 各文件顶层键（2026-11-12）：

| 文件 | 顶层键 |
|---|---|
| `config/mirror.yml` | `schema`、`source`、`sync`、`assets`、`site`、`translation` |
| `config/upstream.yml` | `schema`、`root`、`report_dir`、`fetch`、`structure`、`sections` |
| `config/translation.yml` | `schema`、`provider`、`model`、`api_key_env`、`base_url`、`session_header`、`glossary`、`max_retries`、`temperature`、`segmentation`、`link_text_similarity`、`preserve`、`frontmatter_keys`、`translatable_frontmatter`、`preserve_overlays` |
| `config/translation-rules.yml` | `schema`、`rules` |
| `config/known-translations.yml` | `schema`、`zh-Hans` |
| `config/cli-labels.yml` | `schema`、`headers`、`compare_versions` |
| `config/code-fence-languages.yml` | `aliases`、`prism_languages`、`path_rules`、`auto_detect` |
| `config/english-only-blocks.yml` | `prefixes` |
| `config/sidebar-labels.yml` | `schema`、`hardware` |
| `config/glossary/zh-Hans.yml` | `terms` |
| `config/translation-patches/<locale>/<section>/<page>.yml` | `replace` / `title`（页面级例外） |

两个「唯一事实源」约定，别再加第二份：

- **版本**：`data/manifests/current-version.json`（当前）+ `versions.json`（归档）。`config/mirror.yml`
  里不再列版本。
- **语种**：`docusaurus.config.ts` 的 `i18n.locales` / `i18n.defaultLocale`，由
  `tools/lib/site-config.mjs#resolveLocales()` 解析。`config/mirror.yml` 里曾有一份 `locales:`，
  没有任何脚本读它，已删；不要加回来。

## 4. 管线

六个入口（`guides/PIPELINE.md` 有完整契约）：

| 命令 | 作用 |
|---|---|
| `node tools/pipeline/sync.mjs --update` | 跟随官方：抓取 → 归档/安装 → 爬导航 → 元数据 → CLI 互链 → 结构缓存 → mermaid/颜色 → 物料化 → 资产 → PDF → 剪枝 → 侧边栏 → 校验 |
| `node tools/pipeline/translate.mjs [--mode=apply\|derive\|both] [--plan] [--from=ID] [--only=ID,…] [--locale=TAG]` | 重建中文 overlay 与收尾 pass |
| `node tools/pipeline/build.mjs` | `cli:build` → Docusaurus → Pagefind → `llms.mjs`，自设堆 |
| `node tools/pipeline/verify.mjs [--browser]` | 全部断言；`--browser` 追加浏览器检查（需 `build/` + 本地 Chrome） |
| `node tools/pipeline/report.mjs` | 生成 `reports/` 下的差异与覆盖率 |
| `npm run verify:deploy` | 部署门禁，顺序固定：`build:slim` → `verify:assets` → `verify:base-url` → `verify:orphan-assets` → `verify:llms` |

**stage 模型**：每个 stage 是 `{id, title, run: [脚本, argv]}`（`tools/pipeline/translate-stages.mjs`、
`tools/sync/lib/update.mjs`）。`translate` 的三条入口是同一份 `PASSES` 的三次选择：

- `--mode=apply` → **13** 个 stage（`canonical-apply` + 12 个收尾 pass，含只有 apply 有的 `backfill-captured-at`）；
- `--mode=derive` → **12** 个 stage（`canonical-derive` + 11 个收尾 pass）；
- 默认 `--mode=both` → **31** 个 stage（`harvest` + apply 链 + derive 链 + 5 个只在整条管线里的尾部：
  `normalize-hardware-titles`、`sync-pdfs`、`address-images`、`verify-labels`、`verify-cli`）。两条链都跑，所以同名 pass
  出现两次；`--from` 取**第一次**出现的位置，要精确续跑用 `--mode=derive --from=<id>`。

`--plan` 只打印 `=== <id>: <title>` 与 `$ node …`，不写盘；`--dry-run` 执行各 stage 声明的只读形式，
没有只读形式的（如 `generate-ui`）跳过并注明。journal 在 `.work/translate-run.json`（不入库）。

**顺序上两个硬约束**：

1. `materialize` 之后必须跑 `node tools/sync/address-images.mjs --write`。物料化会把图片写成页面相对的
   `./img/x.webp`，地址化把它们收敛成 `/img/<hash>`（§5.2）。**已接入两条链**：`update.mjs` 的顺序是
   `materialize` → `assets` → `pdf-links` → `pdfs` → `prune-orphans` → `address-images` → `sidebars`
   （`tools/sync/lib/update.mjs:119`）；`translate` 的 `both` 在 `sync-pdfs` 之后跑同一条
   （`tools/pipeline/translate-stages.mjs:98`）；`sync.yml` 在 `prune-orphans` 步骤之后也有一行。脚本幂等，
   当前产物重复跑是 `moved=0 deleted=0 changed=0 refs=9304`。
2. `translate` 之后的收尾 pass 顺序（`PASSES` 里写死，别手调）：
   `generate-ui` → `normalize-links` → `fix-back-to-home` → `fix-asset-links` → `fix-fence-language`
   → `apply-known-translations`。`both` 模式再加 `normalize-hardware-titles` → `sync-pdfs` →
   `address-images` → `verify-labels` → `verify-cli`。

## 5. 三个机制（本轮最大的变化）

### 5.1 baseUrl 同形：本地构建与线上部署走同一个前缀

站点部署在子路径下（`baseUrl = /mikrotik_manual_i18n/`），而官方站是根路径，抓来的内容里到处是
`/videos/x.mp4`、`/img/x.webp` 这类根绝对引用。做法是让**本地构建也用这个前缀**，于是「本地跑通」
与「线上跑通」是同一套产物断言：

- **唯一解析入口**：`tools/lib/site-config.mjs`。它读 `docusaurus.config.ts` 里
  `const siteUrl = …` / `const baseUrl = …` 的**内联字面量**（正则解析），`SITE_URL` / `BASE_URL`
  环境变量优先；`remark-prefix-root-refs`、`llms.mjs`、`asset-refs`、`base-url-refs`、
  `orphan-assets`、`browser-check` 都从这里取值，不再各自留一套 fallback。**把这两个赋值抽成常量会让
  解析失败**，不要重构。
- fallback 就是 `/mikrotik_manual_i18n/`（`docusaurus.config.ts:7`），`resolveBaseUrl()` 现在返回
  `{value:'/mikrotik_manual_i18n/', source:'docusaurus.config.ts'}`。
- **裸 HTML 补前缀**：Docusaurus 只给 `useBaseUrl()` 和 `transformImage` 管得着的东西加前缀，Markdown
  里的裸 `<video src="/…">` 会原样输出。`tools/build/remark-prefix-root-refs.mjs` 在 mdast 上补：
  `mdxJsxFlowElement` / `mdxJsxTextElement` 的 `src`/`href`/`srcset`/`poster`，`<meta>` 的 `content`
  （og:image），以及 CommonMark 的 `html` 节点；只补单斜杠绝对路径，`//`、`data:`、已在前缀下的都不动。
  大写组件（`<Img>`）跳过——它自己走 `useBaseUrl`。
- **设备根路径按文件白名单**：`static/assets/295239801_index2.html` 是被抓下来的 WebFig 登录页，
  里面的 `/favicon.png`、`/assets/style.css` 是**路由器**上的路径，不是镜像的。这类文件由
  `tools/verify/base-url-refs.mjs` 的 `DEFAULT_ALLOW_FILES` 按文件豁免（实测放过 8 条 / 2 个文件），
  不按目录、不按后缀。
- 断言：`npm run verify:base-url`（产物里 `img`/`video`/`link`/`og:image` 等资源型根绝对引用必须在
  baseUrl 之下，实测越界 0 条）。

### 5.2 资产内容寻址：一张图只有一份

历史问题是同一张 WinBox 截图在 `docs/`、两个 `versioned_docs/`、`i18n/` 里有几十份字节相同的副本，
官方还按页面给不同文件名。现在：

- 物理文件只有一个来源：`static/img/<sha256(bytes)[:16]>.<ext>`；引用一律写成站内绝对 `/img/<hash>`。
  名字由内容决定，所以跨版本、跨语种的同字节图片自动塌缩成一份，Webpack 的
  `assets/images/[name]-[contenthash]` 也只产出一份。
- `node tools/sync/address-images.mjs --write` 负责收敛：改写 Markdown 图片、指向本地图片的 Markdown
  链接（`[![](img/a.png)](img/a.png)` 缩略图）、裸 HTML/JSX 的 `src`/`srcset`/`poster`；先把字节复制进
  `static/img/` 再删页面本地副本（崩溃只会多一份，不会少）。**幂等**：第二次 `--write` 是
  `moved=0 rewritten=0 deleted=0`。默认（无 `--write`）只报告。
- `npm run build:slim` 按引用剪 `build/img`：Markdown 图片被 MDX loader `require()`，实际从
  `build/assets/images` 提供，`/img/<hash>` 那份是浏览器永远不加载的重复；只有 `<Img src>`/`<img src>`
  （硬件页）与 config 里的 logo/favicon 真会请求 `/img/<name>`。所以 slim 删除无引用的 blob，并把
  `build/<locale>/{img,assets/images,assets/files}` 这些逐字节重复的副本删掉、把 URL 改回根路径。
  同样幂等；`logo.svg`、`favicon.svg` 受保护。
- 守门：`npm run verify:orphan-assets` 断言「被引用的 `/img/<file>` 都存在」并报告孤儿文件
  （`--strict` 才因孤儿失败）。实测：1695 个文件 / 95.18 MiB，被引用 1695，缺失 0，孤儿 0。

### 5.3 翻译记忆与护栏：overlay 是唯一底稿

legacy 语料（早期的 `content/` 中文项目）**已从本工作区删除**，`i18n/zh-Hans/` 里现有的 overlay
就是唯一中文底稿。因此：

- `npm run translate:harvest` 在 `apply` 之前把「英文块 → overlay 中文块」按结构指纹回收进
  `../work/translate/model-memory.json`（已有键不覆盖，冲突单独计数）。它打印
  `harvest coverage: hardware pendingBlocks before=… after=…`，覆盖率只增不减；若回退则报错。
  **harvest 必须先于 apply**，否则没有记忆的页面会被重建成英文。
- `translate:legacy`（`import-legacy`）是历史命令：`buildLegacy()` 在语料目录不存在时**直接抛错**，
  拒绝把 `translation-memory.json` 覆盖成空文件；`apply` 读的是既有记忆，不是它。
- **中文保留率护栏**：`apply` 重写一页后如果中文数掉到原来的 95% 以下
  （`tools/translate/lib/cjk.mjs` 的 `CJK_REGRESSION_RATIO = 0.95`），就判为回退：保留原 overlay 并计入
  `preserved` / `preservedCjk`，除非显式 `--allow-cjk-loss`。这是为了「改一句措辞」不被误判成丢失。
- `--locale=<tag>` 已参数化到所有 translate 命令（默认 `zh-Hans`）；资源路径只由
  `tools/translate/lib/paths.mjs` 解析（overlay 根、术语表、页面补丁、TM 文件）。`--locale=en` 直接报错
  （它是 source locale）；格式合法但没写进配置的 tag 只允许 `--dry-run`/`--check`。
- **新增语种五步**（`guides/PIPELINE.md#语种locale`）：① `docusaurus.config.ts` 的 `i18n.locales` +
  `localeConfigs`；② `config/glossary/<locale>.yml`；③ 需要时建
  `config/translation-patches/<locale>/`；④ 依次 `harvest` → `index.mjs apply --adopt --locale=<tag>` →
  `index.mjs translate --locale=<tag>` →（需要时）`derive-all.mjs --apply --locale=<tag>` →
  `index.mjs verify --locale=<tag>`（或 `npm run translate:verify:all`）；⑤ 自带 UI 文案（`generate-ui.mjs`
  的 `MANUAL` 表、`llms.mjs` 的 `INDEX_TEXT`）。`derive` 链与 `verify` 都接受 `--locale`：链顺序由
  `derivedFrom` 决定，overlay 路径由 `sectionsFor(locale)` 决定。

## 6. 断言基线（2026-11-12 实测，全部 exit 0）

| 命令 | 通过判定 | 本次实测 |
|---|---|---|
| `npm run translate:verify` | 六棵树全 0 | docs 1484/1484、7.25 1427/1427、7.24 1420/1420、hardware 250、blog 6、changelog 108；`fenceDiff`/`commentDiff`/`commentUntranslated`/`imageDiff`/`frontMatterDiff`/`emptyOverlays`/`untranslatedBlocks`=0；`mdxErrors=0 fences=9668`；`intentionalEnglish=10`（三棵 docs 树各 10） |
| `npm run translate:verify:all` | 只遍历有资源的 locale，全过 | 当前只有 `zh-Hans`：`=== locale zh-Hans` + 上面同一份 0；`all-locales: checked 1 (zh-Hans); failed=0`；无资源的 `ru-RU` 不出现 |
| `npm run verify:tables` | `headers=0` | docs `rows=7201 english=995 prose=14 headers=0 pages=7`；7.25 `7382/1022/21/0/7`；7.24 `9243/1015/17/0/7` |
| `npm run verify:cli` | `english=0 attrMismatch=0` | rows 12285 / 11801 / 11748，`unpaired=0/0`，`compareVersions=1` |
| `npm run verify:labels` | `missing=0` | docs `checked=1470 missing=0`；hardware `categories=12 untranslated=0 overlays=250`；`pdfs missing=0`；`english files=4331 cjk=0` |
| `npm run verify:sidebar` | 全部 `ok` | 7.26 offline 1483 docs / 352 categories（online 1484 页）；7.25 1426（1427）；7.24 1417（1418） |
| `npm run verify:images` | `untranslated=0` | hardware `pages=250 images=408 mismatched=0` |
| `npm run verify:orphan-assets` | `missing=0`、`orphans=0` | 1695 文件 / 95.18 MiB，被引用 1695，缺失 0，孤儿 0 |
| `npm run verify:anchors` | `missing=0` | `TOTAL {anchors:2447, missing:0, upstreamMissing:31, unresolved:36}` |
| `npm run verify:links` | `defects=0` | `TOTAL {defects:0, upstreamDead:4, absoluteHtml:29, toleratedTitle:3559}` |
| `npm run test:locale` | 9 项全过 | `# pass 9 / # fail 0` |
| `npm run verify:base-url` | 越界 0 | 12,178 个 HTML/XML、216,178 条引用，`outside baseUrl = 0`，按文件放行 8 条 / 2 个文件 |
| `npm run verify:assets` | 三个 0 | `locale-prefixed=0`、`double-hash pdf=0`、`missing asset files=0` |
| `npm run verify:llms` | `missing=0`、`outsideBase=0` | 6 份 `llms.txt`（两语种 ×（当前版 + 7.25 + 7.24））、8,668 条站内链接全指向存在的产物，0 条越界 |
| `npm run verify:deploy` | 五步全过 | 先 slim 再跑上面四条；本地没有瘦身产物时用它一步到位；`pages.yml` 在 `build:slim` 之后跑同样四条 |

`browser-check`（`npm run verify:ui`）需要 `build/` 和本机 Chrome（`../vendor/browsers/chrome-linux64/chrome`），
CI 不跑，本地用 `node tools/pipeline/verify.mjs --browser`。

## 7. 已知问题 / 未完成

1. **Pages 1 GB 口径未实测**：slim 后 `build/` 是 1,110,747,914 字节（1.11 GB / 约 1.03 GiB、47,901 个
   文件，`du -sh` 显示 1.2G），按字面值已经超过 GitHub Pages「已发布站点 1 GB」的说法（GB、GiB 两种
   口径都超）。但 Pages 到底怎么算（是否按压缩后、是否重复计 assets、是否只算 HTML）没有实测，所以
   这条只当风险提示，不当结论。
2. **`cmr_wifi_network.webp` 是注释占位**：`docs/management-tools/cmr.md` 与对应 overlay 里被
   `{/* … */}` 包住；上游快照 `upstream/7.26/docs/management-tools/cmr.md` 里是同一段注释，也没有实际
   文件。镜像原样保留这层注释，不要「修好」它。
3. **上游自身的缺陷，不本地修**：4 条死链（`docs/cli-reference/cmr/client.md` → `/docs/cli-reference/cmr/pair`、
   `cmr/device.md` → `/docs/cli-reference/upgrade`、`wired-connections/ethernet.md` → `…/arp` 等）与
   31 条上游缺锚（`#notes`、`#advertise_`、`#mlag-id`…），断言按 tolerated 处理、仍 exit 0
   （`verify:links` 的 `upstreamDead=4`、`verify:anchors` 的 `upstreamMissing=31`）。`reports/upstream-issues.md`
   记的是内容类上游缺陷（其 §10 即 `cmr_wifi_network.webp` 的 404），不含这两组计数。
4. **`STRICT_LINKS` 只在 Docusaurus 配置里生效**：`tools/` 下没有读取点（`grep -rn STRICT_LINKS tools/`
   为空），但 `docusaurus.config.ts:132/138/141` 把它接到 `onBrokenLinks` / `onBrokenMarkdownLinks` /
   `onBrokenMarkdownImages`（`true` 时从 `warn` 变 `throw`）。`README.md` / `ARCHITECTURE.md` 里
   「`STRICT_LINKS=true npm run build` passes」本轮没有复跑，按未验证处理。
5. **`address-images` 已接入 stage/CI**（见 §4）：`tools/sync/lib/update.mjs` 在 `prune-orphans` 之后、
   `sidebars` 之前；`tools/pipeline/translate-stages.mjs` 的 `POST` 在 `sync-pdfs` 之后；
   `.github/workflows/sync.yml` 在 `prune-orphans` 步骤之后。手工补跑仍用
   `node tools/sync/address-images.mjs --write`。
6. **2932 条 page-relative 图片引用不解析**：2929 条在 `upstream/` 快照里（物料化输入，不参与 static/img
   判定），2 条是 `cmr` 的注释占位（`docs/` 与 `i18n/` 各 1），1 条是
   `static/assets/295239801_index2.html` 里的设备侧相对路径（该文件只在 `verify:base-url` 的白名单里，
   与 `static/img` 无关）。`verify:orphan-assets` 只报告、不失败。
8. **`reports/` 的历史报告**：已完成的一次性报告在 `reports/archive/`（归档判据见
   `reports/archive/README.md`）；顶层多数文件是脚本的输出路径、会被重新写入，不要当历史快照。
   `reports/SESSION-PROMPT.md`（已标注被本文取代）与 `reports/NEXT-SESSION.md`（已标「已过期」）的正文
   是旧状态取证材料，不要当现状读。

## 8. 环境陷阱

- **堆**：本机 15 GiB 内存 / 4 核 / **无 swap**。`npm run build` 由 `tools/build/index.mjs` 注入
  `--max-old-space-size=10240`（`BUILD_HEAP_MB` 可覆盖），10 GiB 堆留给系统与 Webpack 的余量不足
  （本工作区的经验是会被 OOM kill）；**本机一律 `npm run build:lowmem`**（`BUILD_HEAP_MB=6144`，
  实测 645 秒跑完，见 §2）。CI 的四个 workflow 里仍是 10240，那里内存更大。
- **后台任务会被回收**：构建要 10 分钟以上，别把整条命令挂在前台等；用后台作业 + 日志文件
  （例如 `work/build-timed.log`），完成后再读日志。
- **每次 bash 的 `/tmp` 是独立的**：命令跑在 `bwrap --tmpfs /tmp` 里，跨命令共享的文件必须落在
  workspace（`work/`）里，写 `/tmp` 下一次就没了。
- **看不见宿主进程**：沙箱 `--unshare-pid`，`ps`/`dmesg` 只看得到当前命令自己；判断构建是否还在跑
  用作业状态，不要用 `ps | grep docusaurus` 下结论。
- **`.git/*.lock` 残留**：上次异常退出会留下 `index.lock`，`git status` 会直接报错；确认没有 git
  进程再删，不要 `git reset`。
- **`build:slim` 幂等**：重复跑只会 `rewrittenOccurrences=0 prunedImgFiles=0`；但**顺序固定**——
  `slim` 必须在 `verify:assets` 之前，否则报的是「产物里还有 locale 前缀」这种真实但可修的状态。
- **一次只跑一个构建**：两个构建会互相删 `build/`；`build/` 在编译期不存在是正常的（Docusaurus 最后才写）。
- **`npm ci` 后 `node_modules` 约 9.4 GB**，磁盘紧张时先看这里。

## 9. 常用命令（一行一条）

```bash
npm ci                                                  # 依赖（约 9.4 GB）
npm run build:lowmem                                    # 本机构建：CLI → Docusaurus → Pagefind → llms（6 GiB 堆）
npm run build                                           # 同上，但用默认 10 GiB 堆（CI 用；本机会 OOM，见 §8）
npm run serve                                           # 本地起静态服务（构建后）
npm run verify:deploy                                   # 部署门禁：slim → assets → base-url → orphan-assets → llms（推荐）
npm run translate:verify                                # 译文结构断言（含 MDX 编译，默认 zh-Hans）
npm run translate:verify:all                            # 同一套断言跑所有有资源的 locale 并汇总
npm run verify:tables                                   # 表格：表头 0 残留、英文散文在预算内
npm run verify:cli                                      # CLI 表：英文 0 行、arg/typ 不漂移
npm run verify:labels                                   # 标签：中文页不沿用英文侧边栏、PDF 本地存在
npm run verify:sidebar                                  # 侧边栏与导航清单一致（离线 + 线上）
npm run verify:images                                   # 硬件组件图片对齐
npm run verify:anchors                                  # 锚点：站内 missing=0
npm run verify:links                                    # 链接：defects=0（上游死链只报告）
npm run verify:orphan-assets                            # static/img 引用完整 + 孤儿报告
npm run test:locale                                     # locale 路径逻辑单测（9 项）
npm run verify:base-url                                 # 产物资源型根绝对引用都在 baseUrl 下
npm run translate:harvest                               # 先把现有 overlay 回收进块记忆（apply 之前必跑）
npm run translate:plan                                  # 只打印 stage 清单
npm run translate:apply                                 # 13 个 stage：重建 zh-Hans overlay + 收尾
npm run translate:derive                                # 12 个 stage：7.24 → 7.25 → 7.26 派生
npm run pipeline:translate                              # 31 个 stage：harvest + apply + derive + 尾部断言
npm run translate:selftest                              # 译文规则自检（不写盘）
npm run sync -- --check                                 # 只检测官方是否变化
npm run sync -- --update                                # 跟随官方（stage 列表见 tools/sync/lib/update.mjs）
npm run sync -- --update --dry-run                      # 预演全流程
node tools/sync/address-images.mjs --write               # 图片收敛到 static/img/<hash>（stage 已接入；手动补跑用这条）
npm run build:slim                                      # 只瘦身（部署形态），幂等
node tools/pipeline/verify.mjs --browser                # 全部断言 + 浏览器检查（需 build/ 与本地 Chrome）
npm run version:sidebars:all                            # 重建全部侧边栏
node tools/sync/sync-pdfs.mjs --apply                   # 重写 overlay 的 PDF 链接并缓存附件
```

## 10. 相关文档

- `guides/PIPELINE.md` —— 管线契约（六个入口、stage 清单、语种、数据契约、有意偏离官方的地方），最该先读。
- `guides/CI.md` —— 四个 workflow、部署门禁、开启自动更新的两步。
- `ARCHITECTURE.md` —— 站点结构、插件路由、构建与产物。
- `TRANSLATION.md` —— 翻译阶段划分、规则台账、修复该落在哪一层。
- `tools/README.md` —— 目录级说明与「验收基线」。
- `reports/` —— 历史取证；`reports/SESSION-PROMPT.md` 已被本文取代。
