# 管线契约

镜像站的全部内容都由管线生成，任何修复都必须落在这里，而不是落在一个文件里。
`docs/`、`versioned_docs/`、`i18n/`、`sidebars.ts`、`versioned_sidebars/` 都是产物。

## 六个入口

| 命令 | 作用 | 实现 |
|---|---|---|
| `node tools/pipeline/sync.mjs --update` | 跟随官方站：抓取 → 归档 → 安装 → 爬导航 → 元数据 → 标签 → 结构缓存 → mermaid/颜色/PDF → 物料化 → 资产 → 剪枝 → 图片寻址 → 侧边栏 → 校验 | `tools/sync/index.mjs` + `lib/update.mjs` 的 stage 列表 |
| `node tools/pipeline/translate.mjs [--mode=apply\|derive\|both] [--plan] [--from=ID] [--only=ID,…] [--locale=NAME]` | 重建中文：`harvest`（把现有 overlay 回收进块记忆）→ `apply`（canonical）→ `derive`（链）→ 枚举值/标题/CLI 后处理 → 硬件标题/PDF/图片寻址/断言 | `tools/pipeline/translate-stages.mjs` 的单一 stage 清单 |
| `node tools/pipeline/build.mjs` | CLI 模型 → Docusaurus → Pagefind（带 10 GiB 堆） | `tools/build/index.mjs` |
| `node tools/pipeline/verify.mjs [--browser]` | 全部断言：结构、表格、CLI、标签、侧边栏、静态图片引用、浏览器 | 见脚本内 steps |
| `node tools/pipeline/report.mjs` | 生成 `reports/` 下的差异与覆盖率 | `materialize --check`、`table-coverage` |
| `npm run verify:deploy` | 部署前门禁，顺序固定：`build:slim` → `verify:assets` → `verify:base-url` → `verify:orphan-assets` → `verify:llms` | `tools/build/slim.mjs` + `tools/verify/{asset-refs,base-url-refs,orphan-assets,llms-links}.mjs` |

关于上表的四点注记：

- **build 入口**：真正干活的是 `tools/build/index.mjs`，它跑 `cli:build` → `docusaurus build` → `pagefind --site build` 并自设 10 GiB 堆；`pipeline/build.mjs` 只是稳定入口，透传参数并把 `--max-old-space-size` 合并进 `NODE_OPTIONS`（已有该标志则尊重操作者的设置，`BUILD_HEAP_MB` 可覆盖堆大小）。
- **工具源码入库**：`.gitignore` 的 `build/` 会匹配任意层级，会把 `tools/build/` 一起吞掉，所以显式加了 `!tools/build/`、`!tools/build/**`；根 `build/` 是产物不入库，`tools/build/` 是源码。
- **断言接入**：加断言时同时更新 `tools/verify/`、`tools/pipeline/verify.mjs` 的 `steps` 与 `ci.yml`；`verify:ui` 依赖 `build/` + Chrome，只在本地用 `--browser` 跑，CI 不跑。
- **部署门禁顺序**：`verify:assets`（`tools/verify/asset-refs.mjs`）**必须在 `build:slim` 之后跑**。`slim` 删掉 `build/<locale>/{img,assets/images,assets/files}` 并把 URL 改回根副本；不先瘦身，`asset-refs` 报的是「产物里还有 locale 前缀」——真实但可修的状态，先瘦身后它才断言「部署形态下无前缀、无悬空引用、无 double-hash PDF 名」。`npm run verify:deploy` 把这五步（`slim` → `asset-refs` → `base-url-refs` → `orphan-assets` → `llms-links`）固定成一条命令；`pages.yml` 在 `build:slim` 之后直接调用同样四个断言（asset/base-url/orphan/llms，不再重复瘦身，见 `guides/CI.md` 的「部署门禁」）。双击哈希 PDF 的成因不是 `sync-pdfs`：`mdx-loader` 的 `transformLinks` 把 Markdown 附件链接改写成 `require()`，`otherAssets` 加载器再给已带哈希的文件名加一个哈希；因此 PDF 链接一律写成裸 `<a href="/assets/files/…" target="_blank" rel="noopener">`（转换见 `tools/translate/lib/pdf-links.mjs`）。`--plan` 的 npm 别名是 `npm run translate:plan`（只打印 stage 清单，不写盘）。
- **harvest 先行**：legacy 语料已删除，现有 overlay 是唯一的中文底稿；`translate:harvest` 在 `apply` 之前把「英文块 → overlay 中文块」按结构指纹对齐后写进 `work/translate/model-memory.json`（已存在键不覆盖，冲突单独计数），否则 `apply` 会把无记忆的页面重建成英文。它打印 `harvest coverage: hardware pendingBlocks before=… after=…`，覆盖率变化以这行数字为准，不设硬编码阈值。

### 译文链只有一份 stage 清单

`translate` 的三条入口（`translate:apply`、`translate:derive`、`pipeline:translate`）是**同一份定义的三次选择**，不再各自维护一份 pass 列表：

- 定义在 `tools/pipeline/translate-stages.mjs`；`PASSES` 按执行顺序只写一次，`modes` 标明它属于哪条链（`backfill-captured-at` 只有 apply 链有）。
- `--mode=apply` 与旧 `translate:apply` 逐条一致（13 条），`--mode=derive` 与旧 `translate:derive` 一致（12 条）；默认 `both`（31 条）= `harvest` + apply 链 + derive 链 + 只在整条管线里跑的尾部（硬件标题、PDF、图片寻址、标签/CLI 断言）。因为两条链都跑，`both` 模式下同一 pass 会出现两次，`--from` 取**第一次**出现的位置；要精确续跑用 `--mode=derive --from=<id>`。
- `--plan` 只打印 `=== <id>: <title>` 与 `$ node …` 命令，不写盘、不写 journal；`--dry-run` 执行各 stage 声明的只读形式（`--check` / `--dry-run` / 去掉 `--apply`），没有只读形式的 stage（如 `generate-ui`）会被跳过并注明。`--check` 系断言用 exit 1 表示"还有活没干"，所以 dry-run 会继续跑完其余 stage 并以非零退出汇总。
- `--from=<id>` 从该 stage 开始（失败后按 journal 里的 `failed_stage` 续跑）；`--only=<id>[,<id>]` 只跑列出的 stage。`--section=` / `--limit=` / `--locale=` 只透传给声明了 `forwards` 的 stage，其余会打印一条 ignored 提示。
- journal 在 `.work/translate-run.json`（不入库）：`{schema, started_at, git_head, mode, from, only, dry_run, stages:[{seq, id, title, command, status, exit_code, started_at, finished_at, duration_ms}], failed_stage?}`。
- 新增一个 pass：只在 `PASSES` 里加一条（`run: [脚本, argv]`，必要时 `modes` / `forwards` / `dryRun`），三条入口自动同步；不要再改 `package.json` 的 `&&` 链。

## 语种（locale）

**事实源只有一份**：`docusaurus.config.ts` 的 `i18n.locales` / `i18n.defaultLocale`，由
`tools/lib/site-config.mjs` 的 `resolveLocales()` 解析成 `{locales, defaultLocale}`。
`config/mirror.yml` 里曾有一份 `locales:`，没有任何脚本读它，已删除；不要再加第二份清单。

所有 translate 命令（含 `derive` 链与 `verify`）都接受 `--locale=<tag>`，默认 `zh-Hans`
（当前唯一的译文语种）；section 与 overlay 路径一律来自 `sectionsFor(locale)`：

- `--locale=en` → 报错：它是 source locale（`i18n.defaultLocale`），永远不是翻译目标；
- `--locale=<不在配置里且格式不合法>` → 报错并列出可用语种（`en, zh-Hans`）；
- 格式合法但还没写进配置的 tag（如 `ru-RU`）→ 只允许 `--dry-run` / `--check`：按约定路径探测、不写盘；
  真正写入前必须先加进 `docusaurus.config.ts`，否则报错；
- `apply` / `derive` 遇到“四个资源一个都没有”的语种直接返回 `files=0`，不会把整站英文写成该语种的
  overlay 镜像；
- `verify` 本身只读，所以任何格式合法的 tag 都能探测；无资源的 locale 输出 0 文件并 exit 0，不会把
  “这个语种还没开工”报成上千个 missing。

**derive（旧版 → 新版 overlay）**：`derive.mjs` 与 `derive-all.mjs` 都接受 `--locale`，链的顺序由
`versions.json` / `derivedFrom` 决定、与语种无关。`--dry-run` 是真正的只读形式（优先于 `--apply`，
报告里 `apply: false`，不写 overlay 也不写 `state/translation-state.json`）：

```bash
node tools/translate/derive-all.mjs --dry-run --locale=ru-RU   # 只读探测，0 文件写出
node tools/translate/derive-all.mjs --apply --locale=ru-RU     # 写入前先启用该 locale
node tools/translate/derive.mjs --from=docs-7.25 --to=docs --locale=ru-RU --dry-run
```

**verify（结构断言）**：`node tools/translate/index.mjs verify` 不带参数时仍只校验 `zh-Hans`，输出与
旧版逐字节一致；`--locale=<tag>` 校验单个语种；`--all-locales` 遍历 `translatableLocales()` 中**已有
资源**的 locale（无资源的会被跳过），对每个语种跑同一套断言并汇总，任一失败 exit 1。`--no-compile`
跳过 MDX 编译（只读探测时更快）：

```bash
node tools/translate/index.mjs verify                       # 默认 zh-Hans，输出不变
node tools/translate/index.mjs verify --locale=ru-RU        # 单语种；无资源时 0 文件、exit 0
node tools/translate/index.mjs verify --all-locales         # npm run translate:verify:all
node tools/translate/index.mjs verify --all-locales --no-compile
```

**命名约定**（只由 `tools/translate/lib/paths.mjs` 解析，其它脚本不再拼字符串）：

| 资源 | 路径 | 解析函数 |
|---|---|---|
| overlay 根 | `i18n/<locale>/<plugin>[/current \| /version-<v>]` | `overlayRootFor(locale, section)`、`sectionsFor(locale)` |
| 术语表 | `config/glossary/<locale>.yml` | `glossaryFile(locale)` |
| 页面补丁 | `config/translation-patches/<locale>/<section>/<page>.yml` | `patchDir(locale)` |
| 全局 TM | `work/translate/tm-global.<locale>.json` | `tmFile(locale)` / `tmFileFor(locale)` |
| 已知译文 | `config/known-translations.yml` 的顶层键 `<locale>` | `apply-known-translations.mjs --locale=<tag>` |
| llms.txt | `build/llms.txt`（源语种）、`build/<locale>/…`；全文 `llms-full.txt` 由插件按语种/版本写在同一目录（`build/llms-full.txt`、`build/<locale>/llms-full.txt`、`build/docs/<v>/llms-full.txt`） | `tools/build/llms.mjs` 遍历 `resolveLocales()`；全文文件由 `build:slim` 保留，只有未被任何 `llms.txt` 引用的版本化副本才允许删（默认只报告） |

section 与 plugin 的对应：`docs` / `docs-<version>` → `docusaurus-plugin-content-docs`（带 `current` 或
`version-<v>` 槽位）；`hardware` → `docusaurus-plugin-content-docs-hardware`（带 `current`）；
`blog` / `changelog` → `docusaurus-plugin-content-blog` / `-blog-changelog`（无槽位，博客插件不版本化）。

**新增一个语种现在要做什么**：

1. 在 `docusaurus.config.ts` 的 `i18n.locales` 加 tag，并在 `localeConfigs` 补 label / htmlLang —— 这是唯一必须改的代码位置；
2. 建 `config/glossary/<locale>.yml`（可先只写 `terms: []`）：它标记“这个语种已开工”，也让 `apply` 不再是空操作；
3. 需要页面级例外时再建 `config/translation-patches/<locale>/`（没有就不读）；
4. 依次跑：`node tools/translate/harvest.mjs`（回收已有 overlay；新语种为 0）→
   `node tools/translate/index.mjs apply --adopt --locale=<tag>`（按 TM / 模型记忆生成 overlay）→
   `node tools/translate/index.mjs translate --locale=<tag>`（只有这一步调模型）；
5. 需要旧版 → 新版派生时：`node tools/translate/derive-all.mjs --apply --locale=<tag>`（先 `--dry-run`
   确认；写入要求该 locale 已启用）；
6. 校验：`node tools/translate/index.mjs verify --locale=<tag>`，或 `npm run translate:verify:all`
   一次跑完所有有资源的语种；
7. 补 UI 文案：`generate-ui.mjs` 里的 `MANUAL` 表与 navbar/footer 文案目前是中文，新语种需要自带一份；
   `tools/build/llms.mjs` 的 `INDEX_TEXT` 同理（缺省回落英文，不会让构建失败）。

## 数据从哪来（文件即契约）

| 文件 | 内容 | 谁写 | 谁读 |
|---|---|---|---|
| `upstream/<v>/manifest.json` | 页面清单、哈希、标题/标签/位置、`corpus_etag`（`llms-full.txt` 的 ETag，旧清单缺失时下一次全量补写） | `fetch-upstream`、`apply-doc-metadata`、`apply-navigation-labels` | materialize、translate |
| `upstream/<v>/structure/pages/*.json` | 渲染页表格结构（含 `<colgroup>` 槽位） | `cache-structure` | materialize |
| `data/manifests/docs-<v>-{sidebar,nav,metadata}.json` | 官方导航、分页、描述、标签 | `crawl-nav`、`extract-doc-metadata` | sidebars、materialize |
| `data/manifests/docs-<v>-{mermaid,inline-colors}.json` | 图示源码、枚举值颜色 | `capture-mermaid`、`capture-inline-colors` | materialize、translate |
| `data/manifests/hardware-pdf.json` | PDF 真实 URL（导出丢了哈希） | `capture-pdf-links` | `sync-pdfs` |
| `work/translate/{model,comment,table}-memory.json` | 译文记忆（块 / 注释 / 表格行 / CLI 行） | `translate`、`harvest`、`tables`、`cli-tables` | `apply`、`derive` |
| `config/*.yml` | 术语表、保留英文、标签策略、CLI 表头词典 | 人 | 各 stage |

## 不变量（断言在哪）

| 承诺 | 断言 |
|---|---|
| 译文结构与英文一致（围栏/注释/图片/front matter/空 overlay） | `translate verify` |
| 未着色围栏中疑似 RouterOS 的比例 ≤5% | `verify:fences`（`tools/verify/fence-coverage.mjs --strict`） |
| 表格不留英文散文、表头不残留、`arg/typ` 不漂移 | `verify:tables`、`verify:cli` |
| 中文页不沿用英文侧边栏标签；硬件分类中文、型号英文；PDF 有本地文件 | `verify:labels` |
| 侧边栏与导航清单一致 | `verify:sidebar` |
| `static/img` 不堆积无引用文件；每个被引用的 `/img/<name>` 都存在 | `verify:orphan-assets` |
| 产物里没有 per-locale 资产副本、没有 double-hash PDF 名、每个被引用的资源都存在（需 `build/`，且**必须在 `build:slim` 之后**） | `verify:assets`（`npm run verify:deploy` 的第二段） |
| 产物里的资源型根绝对引用都在 baseUrl 下（`<Img>` 不漏前缀，需 `build/`） | `verify:base-url` |
| 每个 `llms.txt`（两个语种 + 版本目录）里的站内绝对链接都指向存在的产物文件，`llms-full.txt` 也不例外（需 `build/`，且**必须在 `build:slim` 之后**） | `verify:llms`（`tools/verify/llms-links.mjs`） |
| 页面在浏览器里真的对（29 项，含语种手选持久化） | `browser-check` |

## 新增一条规则的步骤

1. **数据**：能进配置就进 `config/`，能进清单就进 `data/manifests/`；
2. **stage**：写进 `lib/update.mjs` 的 stage 列表（同步侧）或 `pipeline/translate-stages.mjs` 的 `PASSES`（译文侧）；
3. **断言**：在 `tools/verify/` 里加一条，并接进 `ci.yml`；
4. 三样缺一，就只是 `tools/` 里的一次性脚本，不算完成。

## 一次性的脚本

`tools/` 下仍有一些历史脚本（`restore-table-structure`、`apply-sidebar-order`、`backfill-*`）。
它们不参与 CI，也不保证可重复；要复用请先把逻辑搬进上面的 stage 与断言。

- `tools/translate/backfill-provenance.mjs`：给已有 overlay 补 `translated_at` / `translation_provider` / `translation_model` 三个 front matter 键，正文与已有键不动；`translated_at` 取该文件最后一次提交时间，无历史时退回 7.26 抓取时间。默认 `--check` 只报告，`--write` 才落盘。

## 有意偏离官方的地方

这里记的是镜像站与 `manual.mikrotik.com` 行为不一致、而且是**故意**如此的地方。写下来是因为它们看起来像 bug，下一个人容易「顺手修正」掉。

- **`/docs/` 与 `/zh-Hans/docs/` 是客户端跳转，官方是 403。** 官方 docs 用 `slug: /` 的一篇索引页充当 `/docs/`；`90c8473a` 把这篇删了（内容并进 `introduction.md`）之后，docs 插件只生成 `/docs/<slug>`，`/docs/` 本身不再有路由。但语言自动切换会把中文访客送到 `/zh-Hans/docs/`，首页跳转、旧链接和搜索也都指回 `/docs/`，所以这里不能给 404。`src/pages/docs/index.tsx` 因此补了一个 `Redirect`：`/docs/` → `/docs/introduction`，`/zh-Hans/docs/` → `/zh-Hans/docs/introduction`（语言前缀从当前路径取，不硬编码 `/zh-Hans`）。官方 `/docs/` 返回 403，我们返回跳转，属于有意偏离。
