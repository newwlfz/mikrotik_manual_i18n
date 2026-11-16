# Tools

This is the **locale repository's** toolchain: the translation pipeline, the
build chain, the incremental sync with the hub's English content, and the
verification gates. Everything a locale site does to its content is one of
these commands, and every one of them is a separate process — a workflow never
re-implements a step in YAML.

The directory is the canonical copy of that toolchain: a new locale repository
is scaffolded from this template, and each existing one
(`repo_zh_hans`, `repo_zh_hant`, …) carries the same tree. The hub owns this
copy (see the hub's `templates/README.md`); `npm run sync:tools` there copies a
changed file into an existing repository.

## Commands

The supported command surface is this repository's `package.json`; the common
ones:

```bash
npm run content:fetch       # take the hub's content roots into this checkout
npm run translate:pending   # what is still English (exit 0 when nothing is)
npm run translate:batch     # translate the remaining blocks (calls the LLM)
npm run translate:harvest   # recycle the existing overlays into the block memory
npm run translate:apply     # regenerate the overlays offline (adopt mode)
npm run translate:derive    # rebuild an archive overlay from the canonical one
npm run translate:plan      # print the stage list, write nothing
npm run translate:verify    # structural verification of the overlays
npm run verify              # link, asset, label, table and CLI checks
npm run build               # CLI model -> Docusaurus -> Pagefind -> llms.txt
```

`translate:batch` is the only command that calls the model; its endpoint, model
and key come from `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` (Actions
variables and secret, never committed). `translate:apply` and
`translate:derive` read the translation memory and write overlays without
touching the network.

Version pipeline (one command, this is the supported path):

```bash
npm run sync -- --check          # detect remote changes, no writes
npm run sync -- --update         # fetch, normalise and write content
npm run sync -- --repair         # restore missing or changed local files
npm run sync -- --update --dry-run          # preflight + fetch + route report
npm run sync -- --update --from=crawl-nav   # skip the stages already done
```

Order is fixed: fetch -> report -> snapshot -> install -> crawl -> metadata ->
cli-links -> structure cache -> mermaid/colours -> materialize -> assets ->
prune -> sidebars -> verify. Every stage is a separate process; a non-zero exit
or an empty product aborts the run and `state/update-run.json` records where.

Versions are never listed by hand: `data/manifests/current-version.json` is the
installed release, `versions.json` lists the archives, and
`tools/sync/lib/versions.mjs` derives directories, manifests and URLs from them
plus the routing rules in `config/upstream.yml`. The current tree is served at
`/docs/<route>` with its inventory at `/llms.txt`; an archive keeps
`/docs/<version>/<route>`.

Individual stages, for debugging:

```bash
node tools/sync/snapshot-version.mjs --version 7.25
node tools/sync/install-version.mjs --version 7.26 --source upstream/7.26/docs
node tools/sync/crawl-nav.mjs --version=7.26
node tools/sync/build-sidebars.mjs --version 7.25 --docs versioned_docs/version-7.25
node tools/translate/rebase-overlay.mjs --section=docs-7.25 --write
# Re-fetch pages that a strict build reported as broken-link sources.
node tools/sync/repair-doc-links.mjs --version 7.25 --docs docs --log <build.log>
```

## Directories

- `sync/` — inventory, HTTP fetch, Playwright render, transform, state, version
  cut, sidebar generation and metadata extraction. The English content usually
  arrives from the hub instead (`content:fetch` / the hub's `publish-content`);
  the sync stages stay for a standalone checkout and for debugging.
- `cli/` — per-version CLI model and the multi-version comparison index.
- `translate/` — the whole translation pipeline: overlay apply/derive, harvest,
  the offline batch commands, the LLM provider, the translation memory,
  `selftest`, `verify`, the locale profiles and prompts, and the shared Markdown
  libraries (`lib/`) that `sync/`, `verify/` and `build/` also import.
- `verify/` — link / asset / label / table / browser assertions.
- `pipeline/` — `sync`, `translate`, `build`, `verify`, `report` wrappers over
  one stage list (`stages.mjs` for sync, `translate-stages.mjs` for translate).
- `ci/` — the helpers the Pages workflow uses to read a translate batch summary.
- `content/` — `fetch-local.mjs`, which takes a checkout's content from the hub.

Files this repository owns and the template must not overwrite (the hub's
`sync:tools` protects them):

| Path | Why it is local |
| --- | --- |
| `tools/translate/lib/paths.mjs` | `DEFAULT_TARGET_LOCALE` is this repository's locale |
| `tools/bootstrap/**` | repository-specific import/bootstrap scripts |
| `tools/translate/localize-zh-hant.mjs` | the zh-Hant-only post-pass |
| `tools/content/**`, `tools/ci/**` | content acquisition and CI helpers follow this repository's workflow |

Implementation rules:

- No generated file is written without a state entry.
- Missing local files are always repairable.
- A failed locale translation never blocks the English build.
- Translation preserves frontmatter keys, code fences, URLs and MDX names.
- All CLI commands support `--dry-run`.

## Build

`npm run build` 走 `tools/build/index.mjs`：它按顺序跑 `cli:build` →
`docusaurus build` → `pagefind` → `llms.mjs`，并把
`NODE_OPTIONS=--max-old-space-size=10240` 注入子进程（已设置则不覆盖，可用
`BUILD_HEAP_MB` 调整；本机内存小时用 `npm run build:lowmem`）。本仓只构建一个
语种，额外参数会传给 `docusaurus build`。

## 部署瘦身

Docusaurus 会把静态资源复制进语言目录，`build/<locale>/` 下的 `img`、
`assets/images`、`assets/files` 中每个文件都与根目录对应文件逐字节相同。
`npm run build:slim`（`tools/build/slim.mjs`）删除这些副本、把 HTML/XML/JSON 里的
`/<locale>/…` 引用改回根路径，并删除 `llms-full.txt`。该步骤可重复执行；
Pages 工作流在构建之后、上传 artifact 之前调用它。`npm run verify:assets`
（`tools/verify/asset-refs.mjs`）断言不再有语言前缀引用且所有资源文件存在。
静态资源本身来自 hub（`ASSET_ORIGIN`），本仓不存放 `static/img` 的全量副本。

## 验收基线

除 `verify:sidebar`、`browser-check` 外，表格覆盖率是独立指标：

```bash
npm run verify:tables         # rows / english / prose / headers / pages
npm run verify:tables:check   # CI：headers 必须为 0，prose 不超过预算
```

`prose` 只统计「单元格里有小写英文短语」的行（品牌、型号、数值、CLI 占位符不算）；
`headers` 统计首行是表头（下一行是分隔行、含表头词、不含 `<...>`）且仍是英文的表。

改完 overlay 生成逻辑（apply/derive/inline-colors）后必须跑完整的派生链：

```bash
npm run translate:harvest  # 先把现有 overlay 回收进块记忆（apply 之前必跑）
npm run translate:apply
npm run translate:derive   # 7.24 → 7.25 → 7.26，不要再单独调 derive.mjs
```
