# Handover document (HANDOFF)

> **Status — the translation toolchain moved to the locale repositories.** This
> hub (`repo_en`) publishes English only: `translate:*`, `verify:llm` and
> `pipeline:translate` are gone from `package.json`, and the hub's `harvest` /
> `derive` / `apply-known-translations` usage no longer exists. The authoritative
> copy of the toolchain is `templates/locale-repo/tools/`, and it runs in the
> locale repositories (`repo_zh_hans`, `repo_zh_hant`). This file is kept as a
> historical hand-over snapshot: where a command below is no longer in
> `package.json`, run it in the locale repository, and treat `package.json` as
> the source of truth for the current command surface.

> **This repository was split into an English-site repository (2026-11-14).** The
> text below is a hand-over snapshot frozen while the baseline was still a
> bilingual (Chinese/English) single repository; it is kept only for historical
> reference — its `i18n/`, `build/zh-Hans/`, bilingual build timings,
> `state/translation-state.json`, etc. do not belong to this repository. The
> current reference is [`README.md`](../README.md): this repository builds only
> `en` (`SITE_LOCALE=en`), the Chinese site is a separate repository, and this
> repository only provides cross-site language entry points (`LOCALE_ZH_URL` /
> `LOCALE_ZH_BASE_URL`). Where numbers or commands conflict with `README.md`,
> `README.md` wins.

> A status note for "the next session taking over". Every number below was
> measured locally on 2026-11-12, with verification commands in §2 and §6; when
> numbers do not match, find out why before changing the document.

## 1. In one sentence

A Chinese/English mirror of `manual.mikrotik.com` (the official MikroTik RouterOS
manual): a static Docusaurus 3.10.1 site with the current version **7.26** plus
archived **7.25 / 7.24** trees, English being the fetched original prose and
`i18n/zh-Hans/` a full Chinese overlay; `docs/`, `versioned_docs/`, `i18n/`,
`sidebars.ts` and `versioned_sidebars/` are all pipeline outputs, never edited by
hand. **Current state: local debugging is complete, assertions and build are all
green; all changes are in the local `main`, 21 commits ahead of `origin/main`
(20 after this document's first draft was committed), not yet pushed.**

## 2. Current numbers

| Item | Value | Verification command (run in `repo/`) |
| --- | --- | --- |
| Current version | `7.26` | `cat data/manifests/current-version.json` |
| Archived versions | `7.25`, `7.24` | `cat versions.json` |
| Page count in `docs/` | 1484 | `find docs -name '*.md' \| wc -l` |
| Page count in `versioned_docs/version-7.25` | 1427 | `find versioned_docs/version-7.25 -name '*.md' \| wc -l` |
| Page count in `versioned_docs/version-7.24` | 1420 | same as above with the version number changed |
| Page count in `hardware/` / `blog/` / `changelog/` | old HEAD snapshots 250 / 6 / 108; now fetch outputs — for measured counts use `pages.length` in `data/manifests/{hardware,blog,changelog}.json` (official indexes: hardware 256, changelog up to 2026-11-17) | `node -e "for (const s of ['hardware','blog','changelog']) console.log(s, require('./data/manifests/'+s+'.json').pages.length)"` |
| Locales | `en` (default) + `zh-Hans`, 2 total | `node -e "import('./tools/lib/site-config.mjs').then(m=>console.log(m.resolveLocales()))"` |
| `i18n/` translated pages | 4695 = docs 4331 + hardware 250 + blog 6 + changelog 108 | `find i18n -name '*.md' \| wc -l` |
| `static/img` | 1695 files, 95.18 MiB (99,801,808 bytes) | `ls static/img \| wc -l`, `du -sb static/img` |
| `.git` | about 172 MiB (pack 159.11 MiB + ~13.1 MiB loose; loose varies with commit count) | `git count-objects -vH` |
| Build (6 GiB heap) | 645 seconds (10 min 45 s), 12,168 HTML files produced; after the build `build/` is 1.6G (one zh-Hans copy 768M; 1.2G after slim) | `time npm run build:lowmem` |
| `build:slim` | 11 seconds: rewrote 40,268 URLs in 6,085 files, deleted 1,504 unreferenced blobs (89,423,327 B) and 6 copies of `llms-full.txt` (31,022,711 B); result 47,901 files / 1,110,747,914 bytes (≈1.03 GiB, `du -sh` 1.2G) | `npm run build:slim` JSON output, `find build -type f \| wc -l` |
| Ahead of remote | 21 commits (`main` → `origin/main`; 20 after this document's first draft) | `git rev-list --count origin/main..HEAD` |
| Work tree | clean after the commit (this commit only changed this document; previous commit = this document's first draft + the replacement banner in `reports/SESSION-PROMPT.md`) | `git status --short` |

645 seconds is the wall-clock time of `npm run build:lowmem` (6 GiB heap) on this
machine with 4 cores / 15 GiB / no swap, covering `cli:build` → Docusaurus (two
locales, three versions) → Pagefind → `llms.mjs`; `build:slim` adds another 11
seconds and the five `verify:deploy` steps take about 25 seconds together (llms
link scanning 0.4 seconds; 23 seconds on this re-run). Numbers vary a lot between
machines — treat timings as an order-of-magnitude reference only.

## 3. Directories and sources of truth

| Path | What it is | Who writes it / may it be edited by hand? |
| --- | --- | --- |
| `upstream/<version>/` | Official snapshots: `manifest.json` (page list / hashes / titles / labels), `structure/pages/*.json` (rendered table structure, including `<colgroup>` slots) | written by `fetch-upstream`, `cache-structure`; **read-only**, never edit by hand |
| `corrections/` | Human correction layer: `global.yml` (link policy, table restoration, comment style) + `pages/<section>/<version>/<page>.yml` (each must declare `source_sha256`) + `local-pages/` (mirror-owned pages) | written by humans, read and applied by `materialize`; the only place where hand-written content belongs |
| `docs/`, `versioned_docs/` | English prose, materialised outputs | written by `materialize`; do not edit by hand |
| `i18n/zh-Hans/` | Chinese overlays, slotted by plugin/section (docs has `current`, `version-7.25`, `version-7.24`) | written by `translate`; do not edit by hand |
| `sidebars.ts`, `versioned_sidebars/` | Sidebar outputs (current version + one JSON per archived version) | written by `sync-sidebars` (internally calls `build-sidebars`); do not edit by hand |
| `sidebars-hardware.ts` | Hardware sidebar; its header declares it is generated by `pipeline/gen_hardware_sidebar.py`, a script not in `tools/`, and **no existing stage rewrites it** | must be synced by hand when the hardware category structure changes, otherwise `verify:sidebar` only checks the docs side |
| `static/img/` | The single source of site images; file names are content hashes (§5.2) | written by `address-images` |
| `static/assets/` | Official attachments (PDF, rsc, ovpn…) and captured standalone HTML pages | written by `sync-pdfs` and others |
| `data/manifests/` | Official manifests: `docs-<v>-{sidebar,nav,metadata,categories,mermaid,inline-colors}.json`, `cli-links*.json`, `current-version.json` | written by fetch/metadata stages; `current-version.json` is the only source of truth for versions |
| `versions.json` | Archived version list (native to Docusaurus) | written by `snapshot-version` / `install-version` |
| `state/` | Committed hash state: `sync_state.json` (source page hashes), `translation-state.json` (per-page mode and hit counts); `update-run.json` is ignored by `.gitignore` | written by the stages |
| `work/translate/` | Translation memory: `model-memory.json` (block memory), `tm-global.zh-Hans.json`, `table-memory.json`, `comment-memory.json`, `legacy-index.json` | written by `harvest` / `translate`; **outside the repository** (`../work/translate/`), not committed — deleting it loses translations |
| `work/` (inside the repository) | Local temporary logs and `--json` dumps, ignored by `.gitignore` | free to write |
| `config/` | Human-authored switches and word lists; top-level keys in the table below | written by humans |
| `reports/` | Historical reports and evidence; one-off reports in `reports/archive/` | written by humans |

Top-level keys of the `config/` files (2026-11-12):

| File | Top-level keys |
| --- | --- |
| `config/mirror.yml` | `schema`, `source`, `sync`, `assets`, `site`, `translation` |
| `config/upstream.yml` | `schema`, `root`, `report_dir`, `fetch`, `structure`, `sections` |
| `config/translation.yml` | `schema`, `provider`, `model`, `glossary`, `temperature`, `segmentation`, `link_text_similarity`, `preserve`, `frontmatter_keys`, `translatable_frontmatter`, `preserve_overlays` (connection settings come from `LLM_*`, see `guides/LLM.md`) |
| `config/translation-rules.yml` | `schema`, `rules` |
| `config/known-translations.yml` | `schema`, `zh-Hans` |
| `config/cli-labels.yml` | `schema`, `headers`, `compare_versions` |
| `config/code-fence-languages.yml` | `aliases`, `prism_languages`, `path_rules`, `auto_detect` |
| `config/english-only-blocks.yml` | `prefixes` |
| `config/sidebar-labels.yml` | `schema`, `hardware` |
| `config/glossary/zh-Hans.yml` | `terms` |
| `config/translation-patches/<locale>/<section>/<page>.yml` | `replace` / `title` (page-level exceptions) |

Two "only source of truth" conventions — do not add a second copy:

- **Versions**: `data/manifests/current-version.json` (current) + `versions.json`
  (archived). `config/mirror.yml` no longer lists versions.
- **Locales**: `i18n.locales` / `i18n.defaultLocale` in `docusaurus.config.ts`,
  resolved by `tools/lib/site-config.mjs#resolveLocales()`. `config/mirror.yml`
  once had a `locales:` list that no script read; it was deleted — do not add it
  back.

## 4. Pipeline

Entry points (`guides/PIPELINE.md` has the full contract; `translate` has moved
to the locale repositories, so this repository has only the first four plus the
deploy gate):

| Command | Purpose |
| --- | --- |
| `node tools/pipeline/sync.mjs --update` | Follow the official site: fetch → archive/install → crawl navigation → metadata → CLI cross-links → structure cache → mermaid/colours → materialize → assets → PDF → prune → sidebars → verify |
| ~~`node tools/pipeline/translate.mjs …`~~ | **No such entry point in this repository**: commands to rebuild a locale's overlay and the finishing passes exist only in the locale repository (`npm run pipeline:translate`, stage list from `templates/locale-repo/tools/pipeline/`) |
| `node tools/pipeline/build.mjs` | `cli:build` → Docusaurus → Pagefind → `llms.mjs`, with its own heap setting |
| `node tools/pipeline/verify.mjs [--browser]` | All assertions; `--browser` adds browser checks (requires `build/` + a local Chrome) |
| `node tools/pipeline/report.mjs` | Generate diffs and coverage reports under `reports/` |
| `npm run verify:deploy` | Deploy gate in a fixed order: `build:slim` → `verify:assets` → `verify:base-url` → `verify:orphan-assets` → `verify:llms` |

**Stage model**: each stage is `{id, title, run: [script, argv]}` (sync side:
`tools/sync/lib/update.mjs`; the translation side's translate-stages.mjs exists
only in the locale repository, not here). In the locale repository the three
`translate` entry points are three selections of the same `PASSES`:

- `--mode=apply` → **13** stages (`canonical-apply` + 12 finishing passes,
  including `backfill-captured-at`, which only apply has);
- `--mode=derive` → **12** stages (`canonical-derive` + 11 finishing passes);
- default `--mode=both` → **31** stages (`harvest` + apply chain + derive chain +
  5 tail passes that only run in the whole pipeline:
  `normalize-hardware-titles`, `sync-pdfs`, `address-images`, `verify-labels`,
  `verify-cli`). Both chains run, so a pass with the same name appears twice;
  `--from` takes the **first** occurrence — to resume precisely, use
  `--mode=derive --from=<id>`.

`--plan` only prints `=== <id>: <title>` and `$ node …`, writing nothing;
`--dry-run` executes each stage's declared read-only form, skipping and noting
those with none (such as `generate-ui`). The journal is
`.work/translate-run.json` (not committed).

**Two hard ordering constraints**:

1. after `materialize`, `node tools/sync/address-images.mjs --write` must run.
   Materialisation writes images as page-relative `./img/x.webp`, and addressing
   collapses them to `/img/<hash>` (§5.2). **Wired into both chains**: in
   `update.mjs` the order is `materialize` → `assets` → `pdf-links` → `pdfs` →
   `prune-orphans` → `address-images` → `sidebars`
   (`tools/sync/lib/update.mjs:119`); the locale repository's `translate` `both`
   chain runs the same step after `sync-pdfs` (there:
   `tools/pipeline/translate-stages.mjs:98`, no such file here); `sync.yml` also
   has a line after the `prune-orphans` step. The script is idempotent — a repeat
   run on the current outputs gives `moved=0 deleted=0 changed=0 refs=9304`.
2. the order of finishing passes after `translate` in the locale repository is
   fixed in `PASSES` — do not adjust it by hand (no such chain here):
   `generate-ui` → `normalize-links` → `fix-back-to-home` → `fix-asset-links` →
   `fix-fence-language` → `apply-known-translations`. In `both` mode add
   `normalize-hardware-titles` → `sync-pdfs` → `address-images` → `verify-labels`
   → `verify-cli`.

## 5. Three mechanisms (the biggest changes this round)

### 5.1 baseUrl symmetry: local builds and online deploys use the same prefix

The site is deployed under a subpath (`baseUrl = /mikrotik_manual_i18n/`) while
the official site is at the root, so fetched content is full of root-absolute
references like `/videos/x.mp4` and `/img/x.webp`. The approach is to make the
**local build use the same prefix** too, so "works locally" and "works online"
are the same artifact assertions:

- **Single resolution entry point**: `tools/lib/site-config.mjs`. It reads the
  **inline literals** of `const siteUrl = …` / `const baseUrl = …` in
  `docusaurus.config.ts` (parsed with regular expressions), with `SITE_URL` /
  `BASE_URL` taking precedence; `remark-prefix-root-refs`, `llms.mjs`,
  `asset-refs`, `base-url-refs`, `orphan-assets` and `browser-check` all get
  their values from here instead of each keeping a fallback. **Extracting those
  two assignments into constants would break the parsing** — do not refactor.
- the fallback is `/mikrotik_manual_i18n/` (`docusaurus.config.ts:7`), and
  `resolveBaseUrl()` now returns
  `{value:'/mikrotik_manual_i18n/', source:'docusaurus.config.ts'}`.
- **Raw HTML gets the prefix**: Docusaurus only prefixes what `useBaseUrl()` and
  `transformImage` control; a raw `<video src="/…">` in Markdown is emitted
  as-is. `tools/build/remark-prefix-root-refs.mjs` patches the mdast:
  `src`/`href`/`srcset`/`poster` of `mdxJsxFlowElement` /
  `mdxJsxTextElement`, `<meta>`'s `content` (og:image), and CommonMark `html`
  nodes; only single-slash absolute paths are touched — `//`, `data:` and paths
  already under the prefix are left alone. Uppercase components (`<Img>`) are
  skipped because they use `useBaseUrl` themselves.
- **Device-root paths use a per-file whitelist**:
  `static/assets/295239801_index2.html` is a captured WebFig login page whose
  `/favicon.png` and `/assets/style.css` are paths on the **router**, not the
  mirror. Such files are exempted per file by `DEFAULT_ALLOW_FILES` in
  `tools/verify/base-url-refs.mjs` (measured: 8 references in 2 files allowed),
  not per directory or per extension.
- assertion: `npm run verify:base-url` (every resource-type root-absolute
  reference in the artifact — `img`/`video`/`link`/`og:image`, etc. — must be
  under baseUrl; measured 0 out-of-bounds).

### 5.2 Asset content addressing: only one copy of each image

Historically the same WinBox screenshot had dozens of byte-identical copies in
`docs/`, both `versioned_docs/` trees and `i18n/`, with different file names per
page upstream. Now:

- there is only one source of physical files:
  `static/img/<sha256(bytes)[:16]>.<ext>`; references are always the on-site
  absolute `/img/<hash>`. Names are derived from content, so identical bytes
  collapse to one copy across versions and languages, and Webpack's
  `assets/images/[name]-[contenthash]` produces only one too.
- `node tools/sync/address-images.mjs --write` does the collapsing: it rewrites
  Markdown images, Markdown links pointing to local images
  (`[![](img/a.png)](img/a.png)` thumbnails), and `src`/`srcset`/`poster` of raw
  HTML/JSX; it copies bytes into `static/img/` before deleting the page-local
  copy (a crash leaves an extra copy, never a missing one). **Idempotent**: a
  second `--write` gives `moved=0 rewritten=0 deleted=0`. Without `--write` it
  only reports.
- `npm run build:slim` prunes `build/img` by reference: Markdown images are
  `require()`d by the MDX loader and actually served from `build/assets/images`,
  so the `/img/<hash>` copy is a duplicate the browser never loads; only
  `<Img src>`/`<img src>` (hardware pages) and the logo/favicon in config really
  request `/img/<name>`. Slim therefore deletes unreferenced blobs, deletes the
  byte-identical per-locale copies in
  `build/<locale>/{img,assets/images,assets/files}` and rewrites URLs back to the
  root paths. Also idempotent; `logo.svg` and `favicon.svg` are protected.
- gates: `npm run verify:orphan-assets` asserts every referenced `/img/<file>`
  exists and reports orphan files (only `--strict` fails on orphans). Measured:
  1695 files / 95.18 MiB, 1695 referenced, 0 missing, 0 orphans.

### 5.3 Translation memory and guardrails: overlays are the only draft

The legacy corpus (the early Chinese `content/` project) **has been deleted from
this workspace**; the overlays currently in `i18n/zh-Hans/` are the only Chinese
draft. Therefore:

- the locale repository's `npm run translate:harvest` (no such script here)
  aligns "English block → overlay Chinese block" by structural fingerprint
  before `apply` and recycles them into that repository's
  `work/translate/model-memory.json` (existing keys are not overwritten;
  conflicts counted separately). It prints
  `harvest coverage: hardware pendingBlocks before=… after=…`, with coverage
  only increasing; a decrease is an error. **Harvest must come before apply**,
  otherwise pages with no memory get rebuilt into English.
- `translate:legacy` (`import-legacy`) is a historical command (locale
  repositories only): `buildLegacy()` **throws directly** when the corpus
  directory is absent, refusing to overwrite `translation-memory.json` with an
  empty file; `apply` reads existing memory, not that command.
- **Chinese-retention guardrail**: after `apply` rewrites a page, if the Chinese
  count drops below 95% of the original (`CJK_REGRESSION_RATIO = 0.95` in
  `tools/translate/lib/cjk.mjs`), it is treated as a regression: the original
  overlay is kept and counted in `preserved` / `preservedCjk`, unless
  `--allow-cjk-loss` is passed explicitly. This keeps "reword one sentence"
  from being misreported as lost translation.
- `--locale=<tag>` is parameterised across all translate commands (defaulting
  to the locale repository's `DEFAULT_TARGET_LOCALE` in `paths.mjs`); resource
  paths are resolved only by the locale repository's
  `tools/translate/lib/paths.mjs` (overlay root, glossary, page patches, TM
  file). `--locale=en` errors immediately (it is the source locale); a
  well-formed tag not yet configured allows only `--dry-run`/`--check`.
- **Five steps to add a locale** (`guides/PIPELINE.md#locales`): ①
  `i18n.locales` + `localeConfigs` in `docusaurus.config.ts`; ②
  `config/glossary/<locale>.yml`; ③ `config/translation-patches/<locale>/` if
  needed; ④ in order `harvest` → `index.mjs apply --adopt --locale=<tag>` →
  `index.mjs translate --locale=<tag>` → (if needed)
  `derive-all.mjs --apply --locale=<tag>` → `index.mjs verify --locale=<tag>`
  (or the locale repository's `npm run translate:verify:all`); ⑤ supply your own
  UI copy (the `MANUAL` table in `generate-ui.mjs`, `INDEX_TEXT` in
  `llms.mjs`). The `derive` chain and `verify` both accept `--locale`: chain
  order comes from `derivedFrom`, overlay paths from `sectionsFor(locale)`.

## 6. Assertion baseline (measured 2026-11-12, all exit 0)

| Command | Pass criterion | Measured this run |
| --- | --- | --- |
| locale repo's `npm run translate:verify` (no such script here) | six trees all 0 | docs 1484/1484, 7.25 1427/1427, 7.24 1420/1420, hardware 250, blog 6, changelog 108; `fenceDiff`/`commentDiff`/`commentUntranslated`/`imageDiff`/`frontMatterDiff`/`emptyOverlays`/`untranslatedBlocks`=0; `mdxErrors=0 fences=9668`; `intentionalEnglish=10` (10 in each of the three docs trees) |
| locale repo's `npm run translate:verify:all` | only locales with resources, all pass | currently only `zh-Hans`: `=== locale zh-Hans` + the same zeros as above; `all-locales: checked 1 (zh-Hans); failed=0`; `ru-RU` with no resources does not appear |
| `npm run verify:tables` | `headers=0` | docs `rows=7201 english=995 prose=14 headers=0 pages=7`; 7.25 `7382/1022/21/0/7`; 7.24 `9243/1015/17/0/7` |
| `npm run verify:cli` | `english=0 attrMismatch=0` | rows 12285 / 11801 / 11748, `unpaired=0/0`, `compareVersions=1` |
| `npm run verify:labels` | `missing=0` | docs `checked=1470 missing=0`; hardware `categories=12 untranslated=0 overlays=250`; `pdfs missing=0`; `english files=4331 cjk=0` |
| `npm run verify:sidebar` | all `ok` | 7.26 offline 1483 docs / 352 categories (online 1484 pages); 7.25 1426 (1427); 7.24 1417 (1418) |
| `npm run verify:images` | `untranslated=0` | hardware `pages=250 images=408 mismatched=0` |
| `npm run verify:orphan-assets` | `missing=0`, `orphans=0` | 1695 files / 95.18 MiB, 1695 referenced, 0 missing, 0 orphans |
| `npm run verify:anchors` | `missing=0` | `TOTAL {anchors:2447, missing:0, upstreamMissing:31, unresolved:36}` |
| `npm run verify:links` | `defects=0` | `TOTAL {defects:0, upstreamDead:4, absoluteHtml:29, toleratedTitle:3559}` |
| `npm run test:locale` | all 9 pass | `# pass 9 / # fail 0` |
| `npm run verify:base-url` | 0 out of bounds | 12,178 HTML/XML, 216,178 references, `outside baseUrl = 0`, 8 references in 2 files allowed per file |
| `npm run verify:assets` | three zeros | `locale-prefixed=0`, `double-hash pdf=0`, `missing asset files=0` |
| `npm run verify:llms` | `missing=0`, `outsideBase=0` | 6 copies of `llms.txt` (two locales × (current + 7.25 + 7.24)), 8,668 on-site links all pointing at existing artifacts, 0 out of bounds |
| `npm run verify:deploy` | all five steps pass | slim first, then the four assertions above; use this one command locally when there is no slimmed artifact; `pages.yml` runs the same four after `build:slim` |

`browser-check` (`npm run verify:ui`) needs `build/` and a local Chrome
(`../vendor/browsers/chrome-linux64/chrome`); CI does not run it — locally use
`node tools/pipeline/verify.mjs --browser`.

## 7. Known issues / unfinished items

1. **Pages 1 GB interpretation not verified**: after slim, `build/` is
   1,110,747,914 bytes (1.11 GB / ≈1.03 GiB, 47,901 files, `du -sh` shows 1.2G),
   which literally exceeds GitHub Pages' stated "1 GB published site" limit
   (both GB and GiB readings). But how Pages actually measures it (compressed?,
   counting assets twice?, HTML only?) has not been tested, so this is a risk
   note, not a conclusion.
2. **`cmr_wifi_network.webp` is a commented-out placeholder**: in
   `docs/management-tools/cmr.md` and the corresponding overlay it is wrapped in
   `{/* … */}`; the upstream snapshot
   `upstream/7.26/docs/management-tools/cmr.md` has the same comment and no real
   file. The mirror keeps the comment as-is — do not "fix" it.
3. **Upstream's own defects, not fixed locally**: 4 dead links
   (`docs/cli-reference/cmr/client.md` → `/docs/cli-reference/cmr/pair`,
   `cmr/device.md` → `/docs/cli-reference/upgrade`,
   `wired-connections/ethernet.md` → `…/arp`, etc.) and 31 missing upstream
   anchors (`#notes`, `#advertise_`, `#mlag-id`…), treated as tolerated with exit
   0 (`verify:links`'s `upstreamDead=4`, `verify:anchors`'s `upstreamMissing=31`).
   `reports/upstream-issues.md` records content-type upstream defects (its §10 is
   the `cmr_wifi_network.webp` 404), not those two counter groups.
4. **`STRICT_LINKS` only takes effect in the Docusaurus config**: there is no
   reader under `tools/` (`grep -rn STRICT_LINKS tools/` is empty), but
   `docusaurus.config.ts:132/138/141` connects it to `onBrokenLinks` /
   `onBrokenMarkdownLinks` / `onBrokenMarkdownImages` (`warn` → `throw` when
   `true`). The claim in `README.md` / `ARCHITECTURE.md` that
   "`STRICT_LINKS=true npm run build` passes" was not re-run this round and is
   treated as unverified.
5. **`address-images` is wired into stages/CI** (see §4): in
   `tools/sync/lib/update.mjs` after `prune-orphans` and before `sidebars`; the
   `POST` section of `tools/pipeline/translate-stages.mjs` in the locale
   repository after `sync-pdfs`; and `.github/workflows/sync.yml` after the
   `prune-orphans` step. For a manual extra run use
   `node tools/sync/address-images.mjs --write`.
6. **2932 page-relative image references do not resolve**: 2929 are in
   `upstream/` snapshots (materialisation inputs, not part of the static/img
   decision), 2 are the `cmr` commented-out placeholders (one in `docs/`, one in
   `i18n/`), and 1 is a device-side relative path in
   `static/assets/295239801_index2.html` (that file is only in `verify:base-url`'s
   whitelist and unrelated to `static/img`). `verify:orphan-assets` only reports
   them.
8. **Historical reports in `reports/`**: completed one-off reports are in
   `reports/archive/` (archiving criteria in `reports/archive/README.md`); most
   top-level files are script output paths that get rewritten — do not read them
   as historical snapshots. The bodies of `reports/SESSION-PROMPT.md` (marked as
   superseded by this document) and `reports/NEXT-SESSION.md` (marked
   "outdated") are old forensic material, not a description of the current
   state.

## 8. Environment pitfalls

- **Heap**: this machine has 15 GiB RAM / 4 cores / **no swap**.
  `npm run build` has `--max-old-space-size=10240` injected by
  `tools/build/index.mjs` (`BUILD_HEAP_MB` can override it); a 10 GiB heap leaves
  too little margin for the system and Webpack (in this workspace it gets OOM
  killed); **always use `npm run build:lowmem` locally** (`BUILD_HEAP_MB=6144`,
  measured 645 seconds — see §2). The four CI workflows still use 10240 because
  their machines have more memory.
- **Background jobs get reclaimed**: a build takes over 10 minutes, so do not
  leave the whole command in the foreground; use a background job + a log file
  (e.g. `work/build-timed.log`) and read the log when it finishes.
- **Each bash call has its own `/tmp`**: commands run inside `bwrap --tmpfs
  /tmp`; files shared across commands must live in the workspace (`work/`),
  because files written to `/tmp` are gone on the next call.
- **Host processes are invisible**: the sandbox uses `--unshare-pid`, so `ps` /
  `dmesg` only show the current command; use job status to decide whether a
  build is still running, not `ps | grep docusaurus`.
- **Leftover `.git/*.lock`**: an abnormal exit leaves `index.lock` and `git
  status` fails immediately; make sure no git process is running before
  deleting it, and do not `git reset`.
- **`build:slim` is idempotent**: repeat runs only give
  `rewrittenOccurrences=0 prunedImgFiles=0`; but the **order is fixed** — `slim`
  must precede `verify:assets`, otherwise the (real but fixable) "locale prefixes
  remain in the artifact" error appears.
- **Only one build at a time**: two builds delete each other's `build/`;
  `build/` not existing during compilation is normal (Docusaurus writes it last).
- **`node_modules` is about 9.4 GB after `npm ci`**: check here first when disk
  space is tight.

## 9. Common commands (one per line)

```bash
npm ci                                                  # dependencies (~9.4 GB)
npm run build:lowmem                                    # local build: CLI → Docusaurus → Pagefind → llms (6 GiB heap)
npm run build                                           # same with the default 10 GiB heap (CI; OOM locally, see §8)
npm run serve                                           # local static server (after a build)
npm run verify:deploy                                   # deploy gate: slim → assets → base-url → orphan-assets → llms (recommended)
# translation commands have moved out of this repository: translate:verify / translate:verify:all / translate:harvest /
# translate:plan / translate:apply / translate:derive / pipeline:translate /
# translate:selftest all run in the locale repositories (repo_zh_hans, repo_zh_hant); the authoritative copy
# is templates/locale-repo/tools/; see the locale repo's package.json and templates/README.md for the command list.
npm run verify:tables                                   # tables: no leftover headers, English prose within budget
npm run verify:cli                                      # CLI tables: 0 English rows, no arg/typ drift
npm run verify:labels                                   # labels: Chinese pages do not reuse English sidebars, PDFs exist locally
npm run verify:sidebar                                  # sidebars agree with the navigation manifest (offline + online)
npm run verify:images                                   # hardware component images align
npm run verify:anchors                                  # anchors: on-site missing=0
npm run verify:links                                    # links: defects=0 (upstream dead links are only reported)
npm run verify:orphan-assets                            # static/img references complete + orphan report
npm run test:locale                                     # locale path logic unit test (9 items)
npm run verify:base-url                                 # all resource-type root-absolute references are under baseUrl
npm run sync -- --check                                 # only check whether the official site changed
npm run sync -- --update                                # follow the official site (stage list in tools/sync/lib/update.mjs)
npm run sync -- --update --dry-run                      # rehearse the whole flow
node tools/sync/address-images.mjs --write               # collapse images to static/img/<hash> (wired into stages; use this for a manual extra run)
npm run build:slim                                      # only slim (deploy shape), idempotent
node tools/pipeline/verify.mjs --browser                # all assertions + browser checks (requires build/ and a local Chrome)
npm run version:sidebars:all                            # rebuild all sidebars
node tools/sync/sync-pdfs.mjs --apply                   # rewrite overlay PDF links and cache attachments
```

## 10. Related documents

- `guides/PIPELINE.md` — the pipeline contract (entry points, stage list, locales,
  data contract, deliberate deviations from the official site; the `translate`
  entry point has moved to the locale repositories); read this first.
- `guides/CI.md` — the workflows, deploy gate, and the two steps for enabling
  automatic updates.
- `ARCHITECTURE.md` — site structure, plugin routes, build and artifacts.
- `TRANSLATION.md` — translation phases, rule ledger, and which layer a fix
  belongs to.
- `tools/README.md` — directory-level notes and the "acceptance baseline".
- `reports/` — historical evidence; `reports/SESSION-PROMPT.md` has been
  superseded by this document.
