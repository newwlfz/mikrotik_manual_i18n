# Tools

The production automation lives here so the GitHub repository is a complete
site + workflow project, not just build output.

Planned CLI surface:

```bash
npm run sync -- --check          # detect remote changes, no writes
npm run sync -- --update         # fetch normalise and write content
npm run sync -- --repair         # restore missing or changed local files
npm run sync -- --only=docs,hardware,blog,changelog
# Phase 2 only:
# npm run translate -- --changed
# npm run translate -- --locale=zh-Hans --force
npm run verify                   # link, asset and inventory checks
```

Version pipeline (one command, this is the supported path):

```bash
# Discover the release the official site currently serves and import it.
npm run sync -- --update

# Pin the target, report only, or continue an aborted run.
npm run sync -- --update --to=7.26
npm run sync -- --update --dry-run          # preflight + fetch + route report
npm run sync -- --update --from=crawl-nav   # skip the stages already done
npm run sync -- --update --with-translation # derive the new overlay (no API)
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
```

# Re-fetch pages that a strict build reported as broken-link sources.
node tools/sync/repair-doc-links.mjs --version 7.25 --docs docs --log <build.log>
```

## Legacy corpus (removed)

The read-only legacy corpus (`<workspace>/mikrotik_manual_i18n/repo/content`, set by
`DEFAULT_LEGACY_ROOT` in `tools/translate/lib/paths.mjs`) has been deleted from this
workspace, while `work/translate/legacy-index.json` still records its absolute paths.
The two artefacts are loaded independently: the block memory
(`work/translate/translation-memory.json`, ~33k entries) still loads and feeds the
global TM, while the path index is filtered to the entries whose files still exist
(`legacy: memory N entries loaded; index 0/M usable`). Exact whole-page reuse therefore
never matches, and `apply` reports it as `legacySkipped` instead of failing. A page
whose rebuild produces nothing keeps its existing Chinese overlay and is counted as
`preserved` (never deleted). Do **not** run `translate:legacy` (`import-legacy`): it now
refuses to write when the corpus is absent, and on an older revision it would have
replaced the translation memory with an empty one.

Directories:

- `sync/` — inventory, HTTP fetch, Playwright render, transform, state,
  version cut, sidebar generation and metadata extraction.
- `cli/` — per-version CLI model and the multi-version comparison index.
- `translate/` — phase 2 only; config-driven Markdown translation. Not
  implemented or invoked in phase 1. Commands accept `--locale=<tag>` (default
  `zh-Hans`); enabled locales come from `docusaurus.config.ts` and the per-locale
  resource names are documented in `guides/PIPELINE.md#语种locale`.
- `verify/` — link/asset/state checks used by CI.

Implementation rules:

- No generated file is written without a state entry.
- Missing local files are always repairable.
- A failed locale translation never blocks the English build.
- Translation preserves frontmatter keys, code fences, URLs and MDX names.
- All CLI commands support `--dry-run`.

## Build

`npm run build` 现在走 `tools/build/index.mjs`：它按顺序跑 `cli:build` →
`docusaurus build` → `pagefind`，并把 `NODE_OPTIONS=--max-old-space-size=10240`
注入子进程（已设置则不覆盖，可用 `BUILD_HEAP_MB` 调整）。原因：Docusaurus 在一次进程里
构建两种语言，zh-Hans 单独就要 4 GiB 以上，默认堆会在英文构建完成后 OOM。
额外参数会传给 `docusaurus build`，例如 `node tools/build/index.mjs --locale zh-Hans`。

## 部署瘦身

Docusaurus 会把静态资源复制进每个语言目录，`build/<locale>/` 下的 `img`、
`assets/images`、`assets/files` 中每个文件都与根目录对应文件逐字节相同。
`npm run build:slim`
（`tools/build/slim.mjs`）删除这些副本、把 HTML/XML/JSON 里的
`/<locale>/…` 引用改回根路径，并删除 `llms-full.txt`。该步骤可重复执行；
Pages 工作流在构建之后、上传 artifact 之前调用它。`npm run verify:assets`
（`tools/verify/asset-refs.mjs`）断言不再有语言前缀引用且所有资源文件存在。

## 验收基线

除 `translate:verify`、`verify:sidebar`、`browser-check` 外，表格覆盖率是独立指标：

```bash
npm run verify:tables         # rows / english / prose / headers / pages
npm run verify:tables:check   # CI：headers 必须为 0，prose 不超过预算
```

`prose` 只统计「单元格里有小写英文短语」的行（品牌、型号、数值、CLI 占位符不算）；
`headers` 统计首行是表头（下一行是分隔行、含表头词、不含 `<...>`）且仍是英文的表。

改完 overlay 生成逻辑（apply/derive/inline-colors）后必须跑完整的派生链：

```bash
npm run translate:apply
npm run translate:derive   # 7.24 → 7.25 → 7.26，不要再单独调 derive.mjs
```
