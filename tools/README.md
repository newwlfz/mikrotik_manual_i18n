# Tools

The production automation lives here so the GitHub repository is a complete
site + workflow project, not just build output.

Planned CLI surface:

```bash
npm run sync -- --check          # detect remote changes, no writes
npm run sync -- --update         # fetch normalise and write content
npm run sync -- --repair         # restore missing or changed local files
npm run sync -- --only=docs,hardware,blog,changelog
npm run verify                   # link, asset and inventory checks
```

Translation is not part of this repository any more: it is a locale-repository
job, and the toolchain for it lives in `templates/locale-repo/tools/`
(see "Translation toolchain" below).

Version pipeline (one command, this is the supported path):

```bash
# Discover the release the official site currently serves and import it.
npm run sync -- --update

# Pin the target, report only, or continue an aborted run.
npm run sync -- --update --to=7.26
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
# Re-fetch pages that a strict build reported as broken-link sources.
node tools/sync/repair-doc-links.mjs --version 7.25 --docs docs --log <build.log>
```

## Translation toolchain

This repository publishes **English only**. The translation toolchain — overlay
generation, the offline batch commands, the LLM provider, the translation
memory, the selftest and the overlay verify — belongs to the locale
repositories and its **single authoritative copy is
`templates/locale-repo/tools/`** (see `templates/README.md`).

What `tools/translate/` still holds here is the subset the hub's own
build/sync/verify tools import as libraries:

| Kept | Used by |
| --- | --- |
| `lib/paths.mjs`, `lib/frontmatter.mjs` | almost every `sync/`, `verify/` and `build/` tool |
| `lib/blocks.mjs`, `lib/prose.mjs`, `lib/admonitions.mjs` | block splitting and fence masking behind those libraries |
| `lib/links.mjs`, `lib/tm.mjs`, `lib/code-comments.mjs`, `lib/model-memory.mjs` | `verify/links.mjs` (link rules plus the glossary terms read from the translation memory) |
| `lib/html-links.mjs`, `lib/pdf-links.mjs` | `lib/links.mjs` and `sync/sync-pdfs.mjs` (PDF attachment form) |
| `lib/anchors.mjs` | `verify/anchors.mjs` |
| `lib/arg-tables.mjs` | `verify/cli-tables.mjs`, `verify/table-coverage.mjs` |
| `normalize-cli-headers.mjs`, `normalize-titles.mjs`, `normalize-hardware-titles.mjs`, `normalize-newsletter.mjs` | `verify/labels.mjs` (the title and label policy both sides apply) |

Everything else (`index.mjs`, `harvest.mjs`, `derive*.mjs`, `apply-known-translations.mjs`,
`normalize-links.mjs`, `selftest.mjs`, `verify-llm.mjs`, `tables.mjs`, `review.mjs`,
`lib/provider.mjs`, `lib/prompts.mjs`, `lib/llm-config.mjs`, `lib/legacy.mjs`, …) was
removed from this tree. `tools/pipeline/translate.mjs` and its stage list went with
it, and `npm run sync -- --update --with-translation` now fails with a message
that names the locale repository instead of silently skipping the step.

Before editing a kept file, remember it is a copy: a change that is meant for the
whole family belongs in `templates/locale-repo/tools/` first, and
`npm run check:tools-template` reports the drift (whitelisted, per-file
divergences only — see the command's `--help` comment). The hub/template split is
otherwise one-way: edit the template, scaffold new repositories with
`npm run locale:add`, and copy the file into an existing repository by hand.

The legacy corpus (`<workspace>/mikrotik_manual_i18n/repo/content`) was deleted
and the commands that imported it (`translate:legacy`, `translate:harvest`,
`translate:apply`) no longer exist here; `work/translate/legacy-index.json` is the
stale record of that corpus, kept for history.

Directories:

- `sync/` — inventory, HTTP fetch, Playwright render, transform, state,
  version cut, sidebar generation and metadata extraction.
- `cli/` — per-version CLI model and the multi-version comparison index.
- `translate/` — the shared Markdown libraries the other tools import (see
  "Translation toolchain" above). No translation command lives here; the
  authoritative copy of the whole toolchain is
  `templates/locale-repo/tools/translate/`.
- `verify/` — link/asset/state checks used by CI, plus
  `tools-template.mjs` (`npm run check:tools-template`).
- `pipeline/` — `sync`, `build`, `verify`, `report` wrappers over the stage
  lists. The `translate` wrapper belongs to the locale repositories.
- `content/` — the locale registry helpers: `locale:add`, `locales:check` and
  `content:publish` (hub-only; they write into the locale repositories).

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

除 `verify:sidebar`、`browser-check` 外，表格覆盖率是独立指标：

```bash
npm run verify:tables         # rows / english / prose / headers / pages
npm run verify:tables:check   # CI：headers 必须为 0，prose 不超过预算
```

`prose` 只统计「单元格里有小写英文短语」的行（品牌、型号、数值、CLI 占位符不算）；
`headers` 统计首行是表头（下一行是分隔行、含表头词、不含 `<...>`）且仍是英文的表。

overlay 的派生链（`translate:apply` / `translate:derive` / `generate-ui`）不在
本仓：它们随翻译工具链一起移到了语种仓，权威副本在
`templates/locale-repo/tools/`，改完翻译逻辑要在那边跑完整派生链。
