# 新会话提示词：UI 三件套

> 复制下面「提示词正文」整段提交给新会话。

---

## 提示词正文

你接手 MikroTik 手册镜像站的 **站点体验三件套**。先读本条，再读 `guides/PIPELINE.md`，然后动手。

### 0. 仓库与现状

- 仓库 `/home/evan/mikrotik_manual_i18n/repo`，分支 `main`，远端已同步到 `ed3d19c`（工作区应干净）
- Docusaurus 3.10.1，两 locale：`en`（默认）、`zh-Hans`；三个文档版本：7.26（`docs/`）、7.25、7.24
- 构建 `npm run build`（`tools/build/index.mjs` 注入 10 GiB 堆，约 25 分钟，**一次只跑一个**）
- 已有校验：`node tools/pipeline/verify.mjs`（结构/表格/CLI/标签/侧边栏）、`--browser` 追加 22 项浏览器断言
- 铁律：不手改 `docs/`、`versioned_docs/`、`i18n/`、`sidebars.ts`；不 push；报告与提交信息用中文；任何规则都要落成「数据 + stage + 断言」

### 1. 三个功能

#### A. 按浏览器语言自动切换（无语种则回退英文）

- 新建 `src/clientModules/locale-detect.js`，加入 `docusaurus.config.ts` 的 `clientModules`
- 规则：**首次访问**（无 `docusaurus_locale` cookie）时读 `navigator.languages`：
  - 首选语言以 `zh` 开头 → 跳到同一路径的 `/zh-Hans` 版本；
  - 否则保持英文（不做任何跳转）。
- 跳转后写 cookie（一年），此后尊重用户手动切换（Docusaurus 自己会写 `docusaurus_locale`）。
- 必须 SSR 安全（不要在模块顶层访问 `window`）、不能造成重定向循环、不能丢掉 hash 与 query。
- 已知路径形态：英文 `/docs/...`、`/hardware/...`、`/blog/...`；中文 `/zh-Hans/docs/...` 等。

#### B. 首访一次性确认模态

- 新建 `src/theme/Root.tsx`（Docusaurus 官方的全局包装点）渲染 `<ConsentGate>`；组件放 `src/components/ConsentGate/index.tsx`
- 内容三段，语言跟随当前 locale（用 `useDocusaurusContext().i18n.currentLocale` + `src/theme/Root` 可用的 i18n 资源，或 `src/i18n/consent.ts` 常量表）：
  1. **建站目的**：方便非英语母语的 MikroTik 用户阅读官方文档；
  2. **翻译范围**：只翻译自然语言；RouterOS 界面、命令、参数与枚举值以官方英文为准；
  3. **版权**：文档与商标归 MikroTik 所有，本镜像仅作学习用途，链接回官方原文。
- 两个按钮：**「我已了解，继续访问」**（写 localStorage + cookie，关闭）与 **「前往官方文档」**（`location.href` 跳当前页面对应的官方 URL；取不到就跳 `https://manual.mikrotik.com/`）。
- 只弹一次（按浏览器，不按语言）；ESC/点击遮罩不关闭（必须做选择）；弹窗打开时锁滚动、焦点落在主按钮。
- 无障碍：`role="dialog"` `aria-modal="true"`、标题 `aria-labelledby`、按钮可键盘操作。

#### C. 页面底部来源信息

- swizzle `DocItem/Footer`（`src/theme/DocItem/Footer/index.tsx`，已存在同名目录时在其内部扩展）
- 英文页显示：**官方原文 URL**（front matter `source`）+ **抓取时间**（`captured_at`）
- 译文页在此基础上增加：**翻译时间**、**提供商 + 模型名**
- 数据来自 front matter，不要运行时探测。需要在管线里补三个字段：
  - `translated_at`：apply/derive 写入本次时间（ISO 8601，带时区）
  - `translation_provider` / `translation_model`：provider 读 `config/translation.yml` 的 `provider`；model 优先读 `LLM_MODEL`，离线且未配置时回退到 `config/translation.yml` 的 `model`
  - 修改点：`tools/translate/lib/apply.mjs`、`tools/translate/derive.mjs` 的 front matter 组装处；
  - 注意 `translate verify` 的 `frontMatterDiff` 只比较**源文件里已有的键**，新增键不会误报，但要自己跑一遍确认。
- 展示要求：等宽小字、`rel="noopener"`、日期本地化显示（`Intl.DateTimeFormat`），暗色主题可读。

### 2. 断言（必须新增）

在 `tools/verify/browser-check.mjs` 追加：

1. `locale auto-switch`：新上下文（无 cookie）设置 `navigator.language='zh-CN'` 打开 `/docs/`，最终 URL 以 `/zh-Hans/` 开头；语言设为 `en-US` 时不跳转；
2. `consent gate`：首次打开出现模态；点「继续」后消失且刷新不再出现；文案随 locale 变（`/zh-Hans/` 下是中文）；
3. `source footer`：英文页出现官方 URL + 抓取时间；`/zh-Hans/` 页额外出现翻译时间与「提供商 · 模型」。

### 3. 约束与坑

- `clientModules` 里**不要**用 `[...document.querySelectorAll()]`（会被编译成 `[].concat` 导致整站客户端崩溃），用 `Array.from(...)`。
- 不要在 SSR 阶段读 `localStorage`；组件用 `useEffect` + `useState` 的 mounted 模式，避免水合不一致。
- 重定向要 `location.replace`（不要 `push` 进历史），并且只在「首次访问且语言不匹配」时执行一次。
- 模态的 `z-index` 要高于 medium-zoom 遮罩（`--ifm-z-index-overlay`）。
- 页脚不要破坏现有 `DocItem/Footer` 的上一篇/下一篇与反馈组件。
- 构建产物检查：`build/zh-Hans/.../index.html` 里应含 `官方原文`、`翻译时间` 等标记；`grep -c` 自查。

### 4. 交付与回报

1. 本地提交（不 push），`git log --oneline -3`；
2. `npm run build` 退出码与 Pagefind 页数；
3. `node tools/pipeline/verify.mjs --browser` 的输出（应 25 项，22 + 3 新增）；
4. 三张截图：中文模态、英文页脚、中文页脚；
5. 一句话说明：自动切换的判定规则、cookie 名称、如何避免循环。

### 5. 已有事项（不要重做）

- 硬件型号标题已回填英文（`series` → `系列`）、PDF 已缓存到 `static/assets/files`；
- CLI 参考表已中文化，`verify:cli` 全绿；
- 侧边栏/分页标签已回填，`verify:labels` 全绿。
