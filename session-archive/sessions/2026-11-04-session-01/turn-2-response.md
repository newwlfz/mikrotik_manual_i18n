## 1. 已按你的澄清落地

新仓库已建在：

```text
/home/evan/mikrotik_manual_i18n/mikrotik-manual-mirror/
```

Git 已初始化，分支 `main`，**没有 remote**。旧的两个目录完全没有读取、修改或删除。

本轮完成的是“地基”，还没有开始 1,418 页全量抓取：

- 独立 Git 仓库；
- 会话全量落盘 + 摘要索引；
- Docusaurus 3.10.1 脚手架；
- 四类路由的真实构建验证；
- 官方 CSS/JS 快照与哈希清单。

---

## 2. 会话全量落盘与检索索引

目录在：

[session-archive](mikrotik-manual-mirror/session-archive/README.md)

```text
session-archive/
├─ index.json
├─ README.md
├─ summaries/
│  └─ 2026-11-04-session-01.md
├─ fragments/
│  ├─ 01-phase-1-requirements.md
│  ├─ 02-official-site-recon.md
│  ├─ 03-multilingual-and-assets.md
│  └─ 04-execution-plan.md
└─ sessions/
   └─ 2026-11-04-session-01/
      ├─ transcript.md
      ├─ tool-log.md
      └─ meta.json
```

- [transcript.md](mikrotik-manual-mirror/session-archive/sessions/2026-11-04-session-01/transcript.md)：人类可见的完整对话，按回合、用户、助手步骤组织。
- [tool-log.md](mikrotik-manual-mirror/session-archive/sessions/2026-11-04-session-01/tool-log.md)：每一次工具调用的参数和完整结果，带 `tool-001` 这类稳定锚点。
- [index.json](mikrotik-manual-mirror/session-archive/index.json)：后续会话的入口。先读索引，再读摘要，再按主题只加载一个 fragment，最后才回到 transcript 锚点看原文。
- 隐藏思维链没有落盘；保留的是对话正文和工具审计。

以后新会话不需要把整份长对话塞进上下文，按这个顺序读即可：

```text
index.json → summaries/… → fragments/… → transcript.md#turn-N
```

新增会话用：

```bash
python3 pipeline/archive/export_session.py \
  --session-id "$DSH_SESSION_ID" \
  --out session-archive/sessions/<日期>-<会话号>
```

---

## 3. 仓库目录结构

Docusaurus 应用放在仓库根目录，保持官方标准结构；抓取、转换、状态、验证全部隔离到专用目录。

```text
mikrotik-manual-mirror/
├─ versioned_docs/version-7.24/     # 英文 RouterOS 7.24 正文
├─ versioned_sidebars/
├─ hardware/                        # 独立 Docs 插件
├─ blog/                            # Product news
├─ changelog/                       # Docs Changes
├─ i18n/<locale>/                   # 未来译文覆盖层
├─ src/
│  ├─ components/ArgTable/
│  ├─ components/CliCompare/
│  ├─ pages/index.tsx
│  └─ css/custom.css
├─ static/
│  ├─ img/
│  ├─ hardware/
│  └─ blog/
├─ pipeline/
│  ├─ archive/                      # 会话导出
│  ├─ fetch/                        # HTTP + Playwright
│  ├─ transform/                    # .md 规范化 / HTML→MDX
│  ├─ assets/                       # 图片下载、哈希、改路径
│  ├─ cli/                          # ArgTable → JSON → diff
│  ├─ state/                        # sync_state 原子读写
│  └─ verify/                       # 链接、DOM、截图
├─ data/
│  ├─ sync_state.json
│  ├─ manifests/
│  └─ cli/7.24/
├─ vendor/official/3.10.1/          # 官方 CSS/JS/静态资源快照
├─ session-archive/
├─ reports/
│  ├─ build/
│  ├─ sync/
│  └─ visual/
└─ work/                            # 可恢复中间产物，git 忽略
```

约定：

- `pipeline/` 是中间代码，不进入浏览器 bundle。
- `work/` 只放可恢复的 HTML 快照、失败队列、日志，已被 `.gitignore` 忽略。
- 一次性临时文件放系统临时目录，不写进内容目录。
- `data/`、`reports/`、`vendor/`、`session-archive/` 都随 Git 管理。
- `node_modules/`、`build/`、`.docusaurus/`、`work/` 不提交。

---

## 4. 多语言目录怎么排

不复制两套正文。英文是唯一 canonical 源，其他语言用 Docusaurus 标准 i18n 覆盖层：

| 板块 | 英文源 | 未来译文 | URL |
|---|---|---|---|
| RouterOS 7.24 | `versioned_docs/version-7.24/` | `i18n/<locale>/docusaurus-plugin-content-docs/version-7.24/` | `/docs/7.24/...` |
| Hardware | `hardware/` | `i18n/<locale>/docusaurus-plugin-content-docs-hardware/current/` | `/hardware/...` |
| Product news | `blog/` | `i18n/<locale>/docusaurus-plugin-content-blog/` | `/blog/...` |
| Docs Changes | `changelog/` | `i18n/<locale>/docusaurus-plugin-content-blog-changelog/` | `/changelog/...` |
| CLI compare | `data/cli/7.24/en.json` | `data/cli/7.24/<locale>.json` | `/docs/7.24/cli-reference/compare-versions/` |
| 导航/页脚 | 主题配置 | `i18n/<locale>/docusaurus-theme-classic/` | 自动加 locale 前缀 |
| UI 文案 | 源字符串 | `i18n/<locale>/code.json` | 自动加 locale 前缀 |

例如中文上线后：

```text
/zh-Hans/docs/7.24/introduction
/zh-Hans/hardware/netmetal-ax
/zh-Hans/blog/news135
/zh-Hans/changelog/changelog-2026-11-03
```

规则：

- 译文保持与英文相同的文件名和 slug，保证链接、版本差异和 CLI 比对稳定。
- 型号、CLI 命令、参数名、类型不翻译；正文、标题、表格说明、UI 标签翻译。
- 缺译文自动回退英文，允许部分翻译。
- 本阶段只启用 `en`，不显示语言切换器；目录和配置先留好。

---

## 5. 官方 CSS/JS 的使用边界

官方文件已经快照到：

[vendor/official/3.10.1](mikrotik-manual-mirror/vendor/official/3.10.1/manifest.json)

包含官方：

- `styles.b36e0801.css`（99 KB）
- `runtime~main.eb615079.js`（346 KB）
- `main.41c54f56.js`（2.48 MB）
- `logo.svg`、`favicon.svg`

每一项都记录了来源 URL、字节数和 SHA-256。

使用原则：

- 官方 logo、favicon、字体、图标、图片：能原样用就原样用。
- 可分离的官方 CSS 规则：原样复用，并以官方样式表做逐项对照。
- 官方编译后的 `main.js` / `runtime~main.js` **不直接注入**。它们内嵌官方路由表和 7.26/7.25 数据，直接加载会把本地页面带到官方内容源。
- 运行时代码用**同为 3.10.1** 的 Docusaurus 重新生成；再用官方 CSS/DOM 做像素和结构对照。

这不是“自己发明主题”，而是避免把官方编译产物当静态库误用。官方原件仍完整保留，可审计、可对比。

---

## 6. 增量更新设计

`data/sync_state.json` 将记录每个条目：

- 官方源 URL；
- 板块与版本；
- 源文件 Hash；
- 本地文件 Hash；
- 本地路径；
- 关联图片；
- ETag / Last-Modified；
- 同步时间。

脚本模式：

```bash
npm run sync -- --full
npm run sync -- --check
npm run sync -- --repair
npm run sync -- --only=docs,hardware,blog
npm run sync -- --dry-run
```

Hardware / Blog / Changelog 没有 `.md`，所以状态里记录的是**规范化 Markdown 的 Hash**，不是原始 HTML。否则每次构建产生的随机 class、导航都会让文件看起来“变了”。

删除补齐演练会放在内容导入之后：删 docs、hardware、blog 各一个文件，运行 `--repair`，要求三个文件原样恢复、状态同步更新。

---

## 7. 已经真实验证的路由

Docusaurus 3.10.1 已安装，`npm run build` 已成功：

```text
OK  /docs/7.24/introduction/
OK  /docs/7.24/cli-reference/compare-versions/
OK  /hardware/
OK  /blog/
OK  /changelog/
MISS /docs/            ← 符合预期：单版本镜像不发布 current docs
```

证据在：

[reports/build/route-spike.md](mikrotik-manual-mirror/reports/build/route-spike.md)

这证明标准版本化机制可以直接产出 `/docs/7.24/...`，不需要伪造 `/docs/` 或自写路由。

CLI Compare 官方页只在 7.26 current 存在，7.24 本身是 404。因此单版本镜像目前按 `/docs/7.24/cli-reference/compare-versions/` 落地；如果你要求字面复刻官方 `/docs/cli-reference/compare-versions/`，我再加一个标准 Pages 入口，数据层不变。

---

## 8. 下一步

结构已经按“可增量、可多语言、官方机制优先”落地。下一步我会：

1. 建立 7.24 完整清单与 `sync_state` schema；
2. 导入 1,418 页 RouterOS 文档；
3. 抓 250 页 Hardware、10 篇 Blog、132 篇 Changelog；
4. 生成本地 CLI JSON，完成自比对 0 差异；
5. 做删除补齐演练；
6. 构建并用 Playwright 对比官方页面。

如果你对这个目录和路由结构没有异议，我就从第 1 步开始全量抓取。
