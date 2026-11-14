# Translation pipeline

This document explains how content is mirrored and translated, where a
translation defect belongs, and how a fix is persisted so the next version and
the next language get it right without rediscovering it.

The invariant: **overlays are generated, never hand-edited.** Everything that
must survive a regeneration is either code, a rule in the ledger, glossary data,
or a page patch file.

## 1. The pipeline in four stages

### Stage 1 — discover the source pages

- `tools/sync/crawl-sidebar.mjs` drives Chromium against
  `https://manual.mikrotik.com/docs/<version>/introduction`, expands the whole
  sidebar, and writes the ordered route list to
  `data/manifests/docs-<version>-sidebar.json`. This is the page inventory; it
  is not derived from a sitemap guess.
- The version list comes from `config/mirror.yml`; the installed current version
  is `data/manifests/current-version.json`, the historical ones `versions.json`.

### Stage 2 — fetch, normalise and lay out the English content

Two source shapes exist and they are handled differently:

| Section | Source shape | Tool |
| --- | --- | --- |
| RouterOS docs | official `.md` endpoint (`<route>.md`) | `tools/sync/fetch-docs.mjs` |
| Hardware / blog / changelog | rendered HTML, converted to Markdown | `tools/sync/fetch-changelog.mjs` (Turndown + GFM) |

`fetch-docs.mjs` appends `.md` to each route, downloads it, splits the file into
front matter and body, and writes the local tree. The raw download is kept under
`.work/` so a bad conversion can be diffed against the original.

Page changes are detected by a content hash kept in `state/sync_state.json`, so
a page that did not change is never rewritten and never re-translated.

Version moves are separate, explicit operations:

- `tools/sync/snapshot-version.mjs` copies the current `docs/` to
  `versioned_docs/version-<old>/` and rewrites internal links to that version;
- `tools/sync/install-version.mjs` installs a downloaded version as the new
  current and rewrites links the other way.

Images are referenced relatively (`./img/x.webp`) and live next to the English
page. `tools/sync/fetch-assets.mjs` downloads them from the official origin: the
official Markdown keeps the plain name, the site serves a content-hashed asset
(`/assets/images/index-02-<hash>.webp`), and the tool maps one to the other from
the rendered page. `--prune` removes images no page references any more.

Stale pages are removed by `tools/sync/prune-orphans.mjs`. Its inventory is the
official `llms.txt` of each version (it lists every page, CLI entries included)
plus the blog/changelog manifest. Pages the mirror generates itself are listed
under `sync.preserve_pages` in `config/mirror.yml` and are never pruned. Both
tools are dry-run by default and take `--apply`.

### Stage 3 — translate

`tools/translate/` works on units, not whole pages:

1. `import-legacy` reads the previous translation projects and builds a
   translation memory (English block → Chinese block). Only pairs whose
   `source_sha` matches are trusted.
2. `apply` regenerates `i18n/<locale>/...` from the English source. A page whose
   English body is unchanged is reused whole; otherwise each block is looked up
   in the memory and only misses stay English.
3. `derive` rebuilds a non-canonical version from the canonical one: every
   English block that is identical in both versions reuses the canonical
   Chinese, so the same paragraph reads the same way in 7.24 and 7.25. Blocks
   that exist only in the target version fall back to the legacy memory, and
   the rest are translated.
4. `translate` sends exactly those misses to the provider, with the rule ledger's
   prompt rules, and stores the result in the model memory so a later `apply`
   cannot discard it.
5. `verify` checks parity, code fences, images, front matter and MDX.

Both npm chains (`translate:apply`, `translate:derive`) end with the post-passes
that a rebuild cannot get right on its own: `normalize-links` (relative `.md`
links, link text following the target page's Chinese title, similarity threshold
`link_text_similarity` in `config/translation.yml`), `fix-back-to-home`,
`fix-asset-links` (official PDFs to the cached `/assets/files/...`, plus a report
of every link that still leaves the mirror) and `fix-fence-language` (an
overlay's fence info string must equal its English source's, in document order;
`npm run fix:fences:check` reports without writing).

The canonical version is `docs-7.24` (see `npm run translate:derive`). When it is
corrected, re-run derive: the correction propagates to 7.25 for every block
whose English is unchanged, and nothing else is touched.

Matching deliberately ignores three non-content differences: image paths,
whitespace, and the spelling of internal links (`/docs/7.25/x.md`,
`/docs/7.25/x/`, `/docs/x`, `/docs/x/index` are one route).

#### A rebuild may not lose Chinese

The overlay on disk is the only copy of some pages: the legacy corpus is gone,
and `harvest` skips a page whole when its block shape does not line up with the
English capture. For such a page `apply` is not a refresh but an English
rewrite, and no status catches it — the memory still translates *some* blocks,
so the page comes out `partial` and would be written.

`apply` therefore compares the body it is about to write with the body already
on disk, counting CJK characters (`tools/translate/lib/cjk.mjs`: Han characters
of every plane plus Chinese/fullwidth punctuation; fullwidth Latin letters and
digits are not Chinese). If the new body keeps less than 95% of that count
(`CJK_REGRESSION_RATIO`, i.e. a loss of more than 5%), the page is kept byte for
byte and reported as `preserved` with a line

    preserved: <overlay path> zh <old> -> <new>

and counted as `preservedCjk` (`wouldPreserveCjk` in a dry run). An absent
overlay, an English page (0 → 0) and a page that gains text are unaffected.
`apply --allow-cjk-loss` is the explicit opt-out for a deliberate shortening;
it writes the page and reports `cjk-loss-allowed: <path> zh <old> -> <new>`.

The threshold, not a strict comparison, keeps the guard from freezing wording
updates. A translation memory entry that renders a sentence more compactly
(`已禁用` → `禁用`, `请了解与电路相关的危险` → `请了解电气电路相关的危险`) trims a
few characters and is written; a paragraph, table or section replaced by English
loses 60–98% and is kept. At 5% the six pages that `harvest` skipped are all
caught, while the pages that only lost a character or two are refreshed; a 10%
threshold would already miss `dhcp.md` (91.4%) and
`mikrotik-tag-advertisement-formats.md` (91.9%).

#### Comments inside code fences

Code is copied from the English source, with one exception: a line-leading `#`
comment inside a `ros`, `routeros`, `bash`, `sh` or `shell` fence may be
translated. Only the comment text changes; indentation, the `#` run and every
code line stay byte-identical. A `#` inside a string or after code on the same
line is not touched.

Not every `#` line is a comment. RouterOS `print` output puts its header in the
same fence (`#   NAME   TYPE   MTU`), a `cat` transcript puts file content there,
and a TLS key block contains `#` lines that belong to the key. The classifier in
`tools/translate/lib/code-comments.mjs` sorts every line before anything is sent,
and `reports/code-comments-audit.md` publishes the result. Only lines classified
`comment` reach the model.

#### 全局记忆（dry-run 阶段）

同一条英文目前存在三处：7.24 的旧记忆、7.25 的旧记忆、模型记忆（按板块分键）。
`tools/translate/lib/tm.mjs` 把它们合并成一份按"类别 + 归一化英文"索引的全局记忆
（`block` / `comment` / `title` 三个命名空间），并生成 dry-run 报告：

```bash
npm run translate:tm -- --dry-run     # 只出报告，不写记忆、不动 overlay
npm run translate:tm                  # 同时写出 work/translate/tm-global.zh-Hans.json
```

报告（`reports/tm-dry-run.md`）回答：合并多少条、多少同键异译、切换后能新增多少译文。

`apply` 和 `derive` 现在都直接读这份合并后的记忆（每次运行重建，不落中间文件）；
`translate:tm` 只是把同一份结果写出来供检查。版式记忆（block）、注释记忆（comment）、
标题记忆（title）各占一个命名空间，因此一句普通的英文段落不会和同名注释串味。

Comment translations live in their own memory (`work/translate/comment-memory.json`,
keyed by language and comment text), because a comment is not a block: editing one
code line must not invalidate a paragraph, and changing one English comment must
invalidate exactly that comment. `apply` and `derive` both read the memory, so a
comment translated on the canonical 7.24 reads the same way in 7.25.

```bash
npm run translate:audit-comments          # report what would be translated
npm run translate -- comments --dry-run   # list the batches and the cost
npm run translate -- comments --limit=40  # translate the misses
```

### Stage 4 — build and publish

`npm run build` runs three steps and all three are required:

1. `node tools/cli/build-all.mjs` regenerates the CLI model;
2. `docusaurus build` renders both locales;
3. `pagefind --site build` builds the search index the navbar search reads.

Skipping step 3 (running `npx docusaurus build` directly) produces a site whose
search silently fails — that is how the search regression happened once.

Static data is shared across locales by design: `static/` is served at the site
root for every locale, page images live once next to the English page (overlays
rebase their relative URLs onto it), and the Pagefind index is built once over
the whole `build/` tree. Only translated Markdown and the UI catalogues are
per-locale.

`.github/workflows/pages.yml` deploys `main`; `ci.yml` runs the translation
selftest, the structure verification and the build on every pull request.

## 2. Where a defect belongs

Ask three questions in order.

**1. Is the structure or the wiring wrong?**
Wrong link target, lost image, changed code fence, broken front matter, MDX that
does not compile, a page that is not in the sidebar. → **pipeline**
(`tools/translate/lib/*`, `docusaurus.config.ts`). Fix the transform, add a
`verify` check if it can be detected.

`verify` reports `fenceDiff` (code bytes changed), `commentDiff` (a comment
changed without becoming Chinese) and `commentUntranslated` (an English comment
still waiting for translation) separately. Only the first is a structural bug.

**2. Is the structure right but the wording wrong?**
A term translated inconsistently, an identifier translated, a sentence left in
English, over-literal phrasing. → **prompt / glossary** (`config/translation.yml`,
`config/glossary/<locale>.yml`, `tools/translate/selftest.mjs` if the rule can be
tested). Do not patch the overlay.

**3. Is it a single page that genuinely needs an exception?**
One page's title must stay English, one block must not be translated, one phrase
has a fixed official wording. → **patch file**
(`config/translation-patches/<locale>/<section>/<path>.yml`). Patches are data
and are reapplied on every regeneration.

If a "patch" is needed for more than a couple of pages, it is not a patch: it is
a missing rule. Move it into the ledger and enforce it in code.

## 3. How a fix is persisted

Every fix follows the same loop:

```text
observe a defect
  → classify it (pipeline / prompt / patch)
  → write the rule in config/translation-rules.yml
  → enforce it (code, verify check, or selftest case)
  → add a regression case to tools/translate/selftest.mjs
  → regenerate the overlays and review the diff
```

The ledger entry is the memory of *why* the code looks the way it does. The
selftest is the guarantee that a later change does not silently undo it. The
patch layer covers the residue that cannot be generalised.

Current artefacts:

| Artefact | Role |
| --- | --- |
| `config/translation-rules.yml` | rule ledger: id, layer, statement, enforcement |
| `config/glossary/<locale>.yml` | terms that never translate |
| `config/translation.yml` | provider, model, batch, preserved structures |
| `config/translation-patches/` | page-level exceptions, versioned as data |
| `tools/translate/lib/*` | the transforms that implement the rules |
| `tools/translate/verify.mjs` | structural checks after generation |
| `tools/translate/selftest.mjs` | offline regression cases for the rules |
| `reports/translation-review.md` | human review list, regenerated on demand |

## 4. Adding a rule

1. Reproduce the defect on one page.
2. Decide the layer with the three questions above.
3. Add the rule to `config/translation-rules.yml`.
4. Implement it, or record where it is already implemented.
5. Add a case to `tools/translate/selftest.mjs`.
6. Run `npm run translate:selftest`, `npm run translate:verify`, then
   `npm run translate:apply` and `npm run build`.
7. Commit the rule, the code, the test and the regenerated overlays together.

## 5. A new RouterOS version

1. Add the version to `config/mirror.yml`.
2. Crawl its sidebar and fetch its pages (stage 1–2).
3. `snapshot-version` the outgoing current version, `install-version` the new one.
4. Run `npm run sync -- --check` and review the changed-page list.
5. `npm run translate:apply` — unchanged pages are reused from the memory.
6. `npm run translate -- --limit=50` for the misses; `npm run translate:review`
   for the list of pages whose English moved.
7. `npm run build`; commit content, overlays and state together.

## 6. A new language

1. Add the locale to `docusaurus.config.ts` and `config/mirror.yml`.
2. Add `config/glossary/<locale>.yml` and `config/translation-patches/<locale>/`.
3. The pipeline paths are already locale-shaped:
   `i18n/<locale>/docusaurus-plugin-content-docs/...`.
4. Run `import-legacy` (if a previous translation exists for that locale) or go
   straight to `translate`.
5. `write-translations --locale <locale>` for the theme and sidebar catalogues.
6. `verify` and `build`.

Rules do not need to be rewritten per language: they describe structure and
preservation, which are language-independent. Only the glossary and the patch
layer are per locale.

## 7. Commands

```bash
npm run translate:selftest         # offline rule regression tests
npm run translate:legacy           # rebuild the memory from previous projects
npm run translate:apply            # regenerate overlays (adopt mode, offline)
npm run translate:verify           # structural verification
npm run translate -- --limit=50
npm run translate:derive           # rebuild 7.25 from the corrected 7.24
npm run translate:review           # human review list
npm run translate:audit-comments   # classify `#` lines in code fences
npm run translate:comments -- --dry-run --limit=40
npm run build                      # CLI model + Docusaurus + Pagefind
```
