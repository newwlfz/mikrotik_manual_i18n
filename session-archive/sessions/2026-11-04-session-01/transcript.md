# 🛑 【最高纪律与红线：动手

> 由 `pipeline/archive/export_session.py` 从 DSH 会话日志导出。只保留人类可见内容；隐藏推理不落盘。

| 项 | 内容 |
| --- | --- |
| Session | `session-1da523fb-3a00-4238-90c4-c37d34034607` |
| 工作目录 | `/home/evan/mikrotik_manual_i18n` |
| 创建时间 | 2026-11-04 22:52:21 CST |
| 导出时间 | 2026-11-04 23:23:31 CST |
| 轮次 | 2 |
| 工具调用 | 50 |
| 工具审计 | [tool-log.md](tool-log.md) |

<a id="turn-1"></a>

## 回合 1 · 2026-11-04 22:56:09 CST

### 用户

_时间：2026-11-04 22:56:09 CST_

# 🛑 【最高纪律与红线：动手前必读】

1.  **禁止触碰旧资产**：当前工作区中存在两个半成品目录：`mikrotik-docs-i18n` 和 `mikrotik_manual_i18n`。**绝对不要读取、修改、删除或依赖这两个目录中的任何代码和历史记录！**
2.  **100% 官方机制复刻**：目标站点 `https://manual.mikrotik.com/` 是基于 Docusaurus 构建的。请**绝对不要自行发明**路由、组件或特殊的处理逻辑。官方是怎么构建的（如插件分离、版本控制），你必须使用完全一致的标准机制来实现。我要的是 100% 的镜像保真度。
3.  **环境与路径说明**：当前你所在的目录就是**工作区目录**，因为后续要Push到Github，你可根据需要创建仓库目录、临时文件目录等相关目录，要井然有序。
4.  **视觉对比强制要求**：我已在本机安装了 Playwright 及其 Chrome 浏览器。在 Docusaurus 构建完成后，**你必须调用 Playwright 访问本地构建的页面与官方线上页面，进行截图和 DOM 结构的比对**，以证明“细节完备且 100% 复刻”。
5.  **本阶段不碰多语言**：不要做任何翻译，不要搞多语言切换，不要配置 GitHub Actions 增量工作流。

---

### 📖 一、 项目背景与阶段目标

**背景**：我是新手，之前的目标过于宏大导致项目不可控。现在需要稳扎稳打。
**最终目标**：构建具备多语言、多版本、增量同步能力的全站镜像。
**第一阶段（本次任务）**：在全新环境中，**完整镜像官方站点的所有板块**。以 `7.24` 版作为 RouterOS 技术文档的唯一版本。使用 Docusaurus 构建出具备全站功能（包括文档、硬件、新闻、变更日志、CLI 对比）的单版本镜像站。

### 🎯 二、 第一阶段详细任务清单

#### 1. 工作区初始化
*   在当前工作区根目录下初始化全新的 Git 仓库（不要关联旧的 remote）。
*   清理（或隔离）根目录，确保新项目的代码和配置都在根目录下清晰呈现。

#### 2. 全站数据抓取（仅限指定版本与板块）
你需要抓取并本地化以下四大板块：
*   **RouterOS 文档 (7.24)**：通过 `.md` 接口（或 `sitemap.xml`/`llms.txt` 提取 `/docs/7.24/` 路径），全量下载 `.md` 文件，并保持路径结构。
*   **硬件指南 (Hardware Guides)**：该板块官方未公开 `.md` 接口。你需使用 Playwright 访问 `/hardware/`，提取正文，并通过 Turndown 等工具将其高质量转换为 Markdown。
*   **产品新闻 (Blog) 与 变更日志 (Changelog)**：抓取 `/blog/` 和 `/changelog/` 内容（通常有原生 `.md` 接口）。
*   **资源本地化**：全站所有图片和静态资源必须下载到本地，并重写 Markdown 中的引用路径（使用相对路径或 Docusaurus 的静态资源路径），**确保镜像站不依赖官方图床**。

#### 3. Docusaurus 架构与组件复刻（重点）
*   **多插件架构**：官方使用了多个 Docusaurus 插件（例如 Hardware 是独立的插件）。请在 `docusaurus.config.js` 中正确配置 Docs 插件（用于 7.24 文档）、Blog 插件（用于 Product news）以及自定义插件（用于 Hardware 和 Changelog），确保各自的侧边栏、路由不冲突。
*   **侧边栏生成**：完全复刻 7.24 版官方文档的侧边栏层级（`sidebars.js`）。
*   **UI/UX 元素**：复刻官方的导航栏、页脚、代码高亮主题。如果官方在 MDX 中使用了特殊标签（如提示框），必须导入对应组件确保渲染正常。

#### 4. CLI Compare (版本比对) 功能
*   抓取 7.24 版本的 CLI Reference 数据（参数名、类型、默认值）。
*   编写本地比对脚本，让 7.24 与自身比对（差异为 0）。
*   在 Docusaurus 中构建比对页面 UI，确保该功能可以正常工作，为第二阶段（7.25 版）的加入铺平道路。

#### 5. 模拟增量更新与状态验证
*   编写 `sync_state.json` 记录抓取的每一个文件及其 Hash。
*   **模拟演练**：手动删除本地刚刚抓取的 3 个不同板块（如 docs、hardware、blog）的 `.md` 文件。运行你的同步脚本，脚本必须能够通过比对官方源，自动侦测到缺失，并将这几个文件重新下载补齐，且状态库同步更新。

#### 6. 构建与 Playwright 视觉验证
*   执行 `npm run build` 并启动本地服务。
*   **强制要求**：调用已安装的 Playwright 编写一个简单的截图脚本。对本地构建出的页面（例如 `/docs/introduction`, `/hardware/xxx`, `/blog/xxx`）和官方对应页面进行截图或抓取 DOM 结构。对比两者的布局、导航结构是否一致，并将截图报告给我。

---

### 🛠️ 三、 你的执行步骤

1.  **方案汇报**：请先向我汇报你的执行计划。特别是：你打算如何通过 Playwright 提取硬件指南？你打算如何组织 Docusaurus 的多插件路由？**未经确认，不要开始大规模抓取。**
2.  **抓取与状态记录**：执行抓取脚本，保存所有 `.md` 和资源，生成状态文件。
3.  **模拟与验证**：执行增量模拟测试（删除再补齐）。
4.  **构建与视觉对比**：跑通 Docusaurus 构建，使用 Playwright 验证并向我提交对比结果。

**请牢记，我没有任何代码经验，如果代码跑不通、或者你用自己发明的特殊逻辑替代了官方的标准机制，我们的沟通成本会极高。请严格遵循官方架构。现在，请开始制定你的执行计划。**

### 助手 · 步骤 1

_时间：2026-11-04 22:56:25 CST_

我会先做只读调研并核对一个**关键冲突**，然后给出可执行方案，不会先抓取。

## ⚠️ 先说明：工作区路径与红线冲突

你要求**绝对不要读取/修改/删除** `mikrotik_manual_i18n`，但当前运行环境的工作目录恰好就是 `/home/evan/mikrotik_manual_i18n`，且沙箱只允许写入该目录。因此我暂时**不会列出、读取或改动这个目录里的任何东西**。

下面我先只读调研官方站点的真实架构和接口，再请你确认新仓库放在哪里。

### 助手 · 步骤 13

_时间：2026-11-04 23:08:15 CST_

# 第一阶段执行计划（待你确认后开工）

本轮我只做了**只读探测**，没有读取、修改或删除 `mikrotik-docs-i18n`、`mikrotik_manual_i18n` 中的任何内容，也没有开始批量抓取。

---

## 0. 必须先解决：工作区路径冲突

你的红线要求“绝对不要碰 `mikrotik_manual_i18n`”，但当前会话的工作目录恰好就是：

```text
/home/evan/mikrotik_manual_i18n
```

而文件沙箱只允许我写入这个目录。也就是说：

- 在这个目录里建 Git 仓库、放代码，必然要“碰”旧目录；
- 写到同级新目录，又超出当前沙箱范围，需要额外授权。

所以我不能一边遵守红线，一边直接在当前位置开工。**这是目前唯一的硬阻塞。**

---

## 1. 只读调研结论

官方站点确认使用 **Docusaurus 3.10.1**，架构如下：

| 板块 | 官方机制 | 规模 |
|---|---|---|
| RouterOS Docs | 默认 Docs 插件，版本化文档：7.26 current、7.25、7.24 | 7.24 共 **1,418** 个内容文件，其中 CLI Reference **1,054** 个 |
| Hardware | **独立的 Docs 插件实例**，`plugin-id-hardware`，路由 `/hardware/` | **250** 个页面 |
| Product news | 独立 Blog 插件实例，路由 `/blog/` | **10** 篇文章 |
| Changelog | 另一个独立 Blog 插件实例，路由 `/changelog/`，标题 “Docs Changes” | **132** 篇 |
| CLI Compare | 官方自定义 MDX 页面 + `<CliCompare />` 组件，路由 `/docs/cli-reference/compare-versions/` | 仅 current 7.26 有，7.24 下是 404 |

关键发现：

1. **7.24 不在 `sitemap.xml` 里**。sitemap 只列当前版本，不能作为 7.24 的清单来源。
2. 7.24 的 `.md` 接口可用，例如：
   `https://manual.mikrotik.com/docs/7.24/introduction.md`
3. Hardware、Blog、Changelog **没有公开 `.md` 接口**，必须用 Playwright 提取正文后转 Markdown。
4. 官方 CLI 页面使用 `<ArgTable>`、`<ArgTableRow>` 等 MDX 组件，不是普通 Markdown 表格；镜像时必须实现同款组件，不能简单当纯文本处理。
5. 官方首页是客户端渲染页面，不能只抓静态 HTML，必须用 Playwright 获取渲染后的 DOM。

---

## 2. 目标仓库结构

统一采用官方已经暴露出来的路径命名，不自己发明：

```text
mikrotik-manual/
├─ docusaurus.config.ts
├─ sidebars.ts
├─ versions.json
├─ versioned_docs/
│  └─ version-7.24/              # 官方同款版本目录
├─ versioned_sidebars/
│  └─ version-7.24-sidebars.json
├─ hardware/                     # 独立 Hardware Docs 插件
├─ blog/                         # Blog 插件
├─ changelog/                    # Changelog 插件
├─ src/
│  ├─ pages/index.tsx            # 首页
│  └─ components/
│     ├─ ArgTable/
│     └─ CliCompare/
├─ static/
│  ├─ img/                       # 全站图片
│  └─ hardware/                  # 硬件产品图
├─ data/cli/7.24.json            # CLI 比对数据
├─ scripts/
│  ├─ fetch-docs.mjs
│  ├─ fetch-rendered.mjs
│  ├─ fetch-assets.mjs
│  ├─ build-cli-data.mjs
│  └─ verify-mirror.mjs
├─ sync_state.json
└─ reports/
```

---

## 3. Docusaurus 多插件路由设计

严格按官方插件类型配置：

1. **Docs 插件（默认实例）**
   - `routeBasePath: 'docs'`
   - 只包含 `version-7.24`
   - `versions.json: ["7.24"]`
   - `lastVersion: '7.24'`
   - `onlyIncludeVersions: ['7.24']`
   - 目标 URL 保持 `/docs/7.24/...`

2. **Hardware Docs 插件（独立实例）**
   - `id: 'hardware'`
   - `routeBasePath: 'hardware'`
   - `path: 'hardware'`
   - 独立侧边栏，不与 `/docs` 冲突

3. **Blog 插件实例一**
   - `routeBasePath: 'blog'`
   - 内容目录 `blog/`

4. **Blog 插件实例二**
   - `routeBasePath: 'changelog'`
   - 内容目录 `changelog/`
   - 标题 “Docs Changes”

5. **Pages 插件**
   - 首页
   - CLI Compare 页面容器

6. **主题**
   - 官方导航顺序：Logo → Docs → Hardware → Compare Versions → Blog → Changelog
   - 复刻页脚、代码高亮、提示框、Tabs、右侧 TOC、版本下拉框

> 批量导入 1,400 多页之前，我会先做一次**最小路由验证**：只放 2 个页面，确认 Docusaurus 3.10.1 在 `onlyIncludeVersions` 下确实生成 `/docs/7.24/...`。验证通过后再全量导入，避免路径错误返工。

---

## 4. 抓取与转换方案

### 4.1 RouterOS 7.24 文档

1. 从 7.24 首页侧边栏递归抓取分类页，得到完整侧边栏树。
2. 用官方运行时里的 1,418 个源文件清单做**完整性交叉校验**，防止漏页。
3. 逐页请求 `.md` 接口，保存到 `versioned_docs/version-7.24/`。
4. 处理官方 `.md` 导出的两个问题：
   - 会自动重复一个 H1 和摘要引用块，需要去重；
   - 可能丢失 frontmatter，需要从页面 HTML 补 `title`、`sidebar_label`、`sidebar_position`、`slug`、`description`。
5. 扫描 MDX 标签，补齐 `<ArgTable>`、`<Tabs>`、提示框等组件导入。
6. 根据侧边栏树生成 `version-7.24-sidebars.json`，保持官方层级和顺序。

### 4.2 Hardware 250 页

1. Playwright 打开 `/hardware/`，递归展开侧边栏，收集全部产品页。
2. 只提取正文区域，剔除导航、面包屑、目录、上一页/下一页、复制按钮等 UI。
3. 用 **Turndown + GFM 插件**转 Markdown，并加自定义规则处理：
   - 提示框 → Docusaurus admonition
   - 代码块语言
   - 表格
   - 产品规格表
   - 图片 `src` / `srcset`
4. 生成 frontmatter 和 Hardware 独立侧边栏。
5. 产品图全部下载到 `static/hardware/`，重写引用。

### 4.3 Blog 与 Changelog

1. 分别枚举 10 篇 Blog 和 132 篇 Changelog。
2. Playwright 提取文章正文。
3. 保留 frontmatter：标题、日期、作者、标签、slug。
4. 转 Markdown，图片本地化。
5. 使用官方同款 `blog/YYYY-MM-DD-slug/index.md`、`changelog/YYYY-MM-DD-changelog/index.md` 目录结构。

### 4.4 图片与静态资源

- 扫描 Markdown、HTML、CSS 中的图片和静态资源；
- 按 SHA-256 去重；
- 下载到 `static/`；
- 统一改写为本地绝对路径或 Docusaurus 静态路径；
- 生成资源清单，确保构建不依赖官方图床。

---

## 5. CLI Compare 功能

### 数据生成

从 1,054 个 CLI `.md` 中解析：

- 命令/菜单路径
- 参数名
- 类型
- 是否必填
- 描述
- Flag
- 默认值（页面中存在时）

输出：

```json
{
  "version": "7.24",
  "commands": {
    "ip/address": {
      "type": "Directory",
      "arguments": [],
      "flags": []
    }
  }
}
```

### 页面

复刻官方 `<CliCompare />` 的界面和交互：

- 两个版本选择器
- “New commands / Removed commands”
- “Added parameters / Removed parameters”
- 命令分组、参数表格、差异计数

### 验证

- 7.24 对 7.24：新增 0、删除 0、参数差异 0。
- 再复制一份临时数据，手动增删一个参数，确认比对器能准确识别。
- 这样既证明“自比对为 0”，也证明第二阶段加入 7.25 后差异引擎真的可用。

### 路由说明

官方 Compare 页面只在 7.26 下存在，URL 是：

```text
/docs/cli-reference/compare-versions/
```

7.24 本身没有这个页面。由于本阶段只有 7.24，我建议放在：

```text
/docs/7.24/cli-reference/compare-versions/
```

这样能继承 7.24 文档侧边栏，所有链接一致。若你坚持要官方原 URL，我会另做标准 Pages 路由；但页面布局会与文档侧边栏分离，需要单独处理。

---

## 6. 增量同步与状态文件

`sync_state.json` 记录每个文件：

- 本地路径
- 官方源 URL
- 板块类型
- SHA-256
- 文件大小
- 标题
- 关联资源
- 最后同步时间

同步脚本支持三种模式：

```bash
npm run sync -- --full     # 全量抓取
npm run sync -- --check    # 只检查缺失/变化
npm run sync -- --repair   # 补齐缺失文件
```

### 模拟演练

按你的要求：

1. 从 docs、hardware、blog 各删 1 个 `.md` 文件；
2. 运行 `npm run sync -- --repair`；
3. 脚本必须检测到 3 个缺失文件；
4. 自动重新下载并转换；
5. 校验 Hash；
6. 更新 `sync_state.json`；
7. 输出补齐报告。

注意：Hardware/Blog 没有 `.md` 源，所以状态文件记录的是“页面 URL + 转换后 Markdown 的 Hash”，恢复时重新走 Playwright 提取，而不是假装存在 `.md`。

---

## 7. 构建与 Playwright 视觉验收

### 构建

```bash
npm ci
npm run build
npm run serve
```

构建配置开启：

- `onBrokenLinks: 'throw'`
- `onBrokenMarkdownLinks: 'throw'`

任何缺图、错链接都会让构建失败，避免“看起来能跑，实际一堆 404”。

### 对比页面

至少覆盖：

- `/docs/7.24/introduction`
- `/hardware/<某个产品页>`
- `/blog/news135`
- `/changelog/changelog-2026-11-03`
- `/docs/cli-reference/compare-versions/`（或 7.24 版本路径）
- 首页

### 对比内容

每个页面同时截取本地和官方：

1. 1440×900 全页截图；
2. 导航栏链接顺序；
3. 侧边栏层级、标签、顺序；
4. 正文标题、表格、代码块、提示框；
5. 右侧 TOC；
6. 页脚栏目；
7. 关键元素的计算样式（字体、颜色、间距、宽度）。

输出：

```text
reports/visual/
├─ docs-introduction-local.png
├─ docs-introduction-official.png
├─ hardware-local.png
├─ hardware-official.png
├─ ...
├─ report.html
└─ report.json
```

最终我会把截图和 DOM 对比结论一起交给你，不只说“构建成功”。

---

## 8. Git 与交付

- 在新目录初始化全新 Git 仓库；
- **不关联旧 remote**；
- 不加 GitHub Actions；
- 不做翻译、不做多语言；
- 提交 `.gitignore`、`package-lock.json`、README；
- README 写清楚：全量同步、增量修复、构建、视觉验证四条命令。

---

## 9. 需要你确认的两件事

### ① 新仓库放在哪里？

这是必须先解决的：

1. **推荐**：你新建一个空目录，例如  
   `/home/evan/mikrotik-manual`  
   然后在那个目录重新打开本会话。我可以在完全干净的工作区里直接建仓库。
2. 或者：授权我创建同级新目录，但需要 `danger-full-access`，后续写文件可能反复弹授权。
3. 或者：允许我在当前 `mikrotik_manual_i18n` 下新建一个隔离子目录。**不推荐**，因为仍然位于你要求绝对不要碰的目录内。

### ② CLI Compare 用哪个 URL？

- **推荐**：`/docs/7.24/cli-reference/compare-versions/`，继承 7.24 文档侧边栏。
- 或者：严格保留官方 `/docs/cli-reference/compare-versions/`，用独立 Pages 页面实现。

---

请回复这两项选择。确认后我再开始建仓库、装依赖、做路由验证和全量抓取；**在你确认之前，我不会下载全站内容，也不会改动任何旧文件。**

> 本回合工具调用：28 次，完整审计见 [tool-log.md#turn-1](tool-log.md#turn-1)。

<a id="turn-2"></a>

## 回合 2 · 2026-11-04 23:20:01 CST

### 用户

_时间：2026-11-04 23:20:01 CST_

你就使用当前工作区目录即可，我说不能动的是这两个子目录：
evan@Debian-HP800G2:~/mikrotik_manual_i18n$ ls -al
总计 16
drwxrwxr-x  4 evan evan 4096 11月 4日 22:41 .
drwx------ 27 evan evan 4096 11月 4日 22:40 ..
drwxrwxr-x  8 evan evan 4096 10月31日 15:57 mikrotik-docs-i18n
drwxrwxr-x  6 evan evan 4096 11月 4日 22:40 mikrotik_manual_i18n
无视它们存在即可。

我要求你对会话当中的对话内容进行全量落盘，并生成额外的摘要索引，供后续其他会话阅读并根据需要提取对应的全量内容片段，可放在专门的目录当中。
因为后续是要做多语言版本的，默认就是来源的英文版，而每个语种都会有RouterOS、Hardware Guides、CLI compare、Product news、Docs Changes，目录结构你打算怎么安排，请说说。
记住是100%复刻，所以CSS样式表文件、JS文件等等，请尽可能使用官方文档原版的。
代码一定要考虑到后续的“增量更新”事宜，相关的中间代码请归类到专用的目录当中，临时文件要么就放系统临时目录，要么在工作目录创建专门的目录来存储。
其他的要push到Github的数据，放在专门的目录当中，并使用git进行版本管理。

### 助手 · 步骤 1

_时间：2026-11-04 23:21:03 CST_

收到。工作区关系已明确：新项目会放在当前目录下的**全新子目录**，旧的两个目录完全不读、不改。  
我先做两件不会触发全站抓取的事：**建立独立 Git 仓库骨架**，以及**把本次会话落盘并建立可检索索引**；随后给你完整的多语言目录设计。

> 本回合工具调用：22 次，完整审计见 [tool-log.md#turn-2](tool-log.md#turn-2)。
