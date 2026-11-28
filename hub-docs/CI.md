# CI and automatic updates

> **Status — the translation toolchain moved to the locale repositories.** This
> hub (`repo_en`) no longer carries a translation command: `translate:*`,
> `verify:llm` and `pipeline:translate` were removed from `package.json`, and the
> hub's `harvest` / `derive` / `apply-known-translations` entry points are gone.
> The authoritative copy of the toolchain is `templates/locale-repo/tools/`, and
> the `translate` job described below runs inside each locale repository
> (`repo_zh_hans`, `repo_zh_hant`), so every `tools/translate/...` path in this
> file refers to the locale repository's copy of that tree. This file is kept as
> the historical CI description; the hub's own gate list is defined by
> `package.json` and `pages.yml`.

In the multi-repository model there are only three workflows, with non-overlapping
responsibilities:

| Repository | Workflow | Trigger | Purpose |
| --- | --- | --- | --- |
| hub `mikrotik_manual_i18n` | `sync.yml` | daily 03:00 UTC / manual | ETag probe of the official site → `sync --update` only when it changed → commit and push → dispatch `pages.yml` (see "Scheduled sync" below) |
| hub `mikrotik_manual_i18n` | `pages.yml` | push to `main` / manual / dispatch from `sync.yml` | `build` builds the English site; `deploy` publishes after the deployment gate; `publish-content` pushes the ten content roots in `CONTENT_ROOTS` plus `locales.json` to each language repository |
| language repository (e.g. `mikrotik_manual_zh_hans`) | `pages.yml` | push to `main` / manual | `translate` (reads the pushed English prose + this repository's `i18n/` overlays) → `build` → gate → `deploy` |

The hub does **not build** any other language, and a language repository does
**not build** the English site; the two sites' language dropdowns and hreflang
tags point at each other through the absolute addresses in `locales.json` (see
[ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md)).

## Hub: build + publish

`pages.yml` has three jobs:

| Job | Depends on | Condition | Description |
| --- | --- | --- | --- |
| `build` | — | manual run other than `publish_only` | `npm ci` → `npm run build` (`SITE_LOCALE=en`, `ASSET_HOST=true`) → `npm run verify:deploy` → upload the Pages artifact |
| `deploy` | `build` | `build` succeeded | `actions/deploy-pages` |
| `publish-content` | `build` (`always()`) | push to `main`, or manual with `publish_only` checked | `locales:check` → check `CROSS_REPO_TOKEN` → `node tools/content/publish.mjs` |

`publish-content` is **decoupled** from this repository's build: on a push to
`main` it runs even if `build` failed (a failed English deploy must not stop the
language sites from receiving corrected content). To re-push content only, use a
manual run with `publish_only`, which skips `build`/`deploy` and saves the 13–14
minute build. The language repository's own `build` is the second gate: if the
content is broken, it will not deploy.

For each non-default locale: clone → replace the target tree wholesale with the
hub's content roots (directories) / overwrite files (`sidebars.ts`,
`sidebars-hardware.ts`, `versions.json`) → write `locales.json` → assert that
`.gitignore` does not ignore any root (otherwise fail **before** the commit and
print the specific rule) → commit only if `git status --porcelain` is non-empty →
push. The push triggers the language repository's `pages.yml`. The content-root
list (`CONTENT_ROOTS`): `docs/`, `versioned_docs/`, `hardware/`, `blog/`,
`changelog/`, `data/`, `sidebars.ts`, `sidebars-hardware.ts`,
`versioned_sidebars/`, `versions.json`; `static/` is not included (assets are
served by the English site). The token is a fine-grained PAT stored as the
`CROSS_REPO_TOKEN` Actions secret in the **hub repository**; it is not bounded by
this repository's `permissions: contents: read`. If it is missing the job fails
explicitly with setup instructions — it never silently skips.

## Scheduled sync (`sync.yml`)

Every day at 03:00 UTC (11:00 Asia/Shanghai) the hub repository checks the
official site itself and **fetches only if it changed**:

| Step | What it does | Notes |
| --- | --- | --- |
| probe | `node tools/sync/index.mjs --probe` | Reads `/llms.txt` for the official current release, then sends one conditional GET with `If-None-Match` to `/llms-full.txt` (the ETag is stored as `corpus_etag` in `upstream/<version>/manifest.json`) |
| hit | exit code `0` | Official corpus matches the manifest: no page requests, no files written, no commit; the whole run takes 1–2 minutes (mostly `npm ci`) |
| miss | `--update` | Version or ETag changed: run the full pipeline (fetch → snapshot → install → crawl → materialise → assets → sidebars → prune → verify) |
| commit | `sync: upstream update <yyyy-mm-dd>` | Commit only if `git status --porcelain` is non-empty; the version-routing diff in `reports/` is committed with it as sync evidence |
| build | dispatch `pages.yml` | See the recursion rule below |

Exit-code convention for `--probe`: `0` = unchanged, `10` = sync needed, `2` =
probe failed. **A failed probe does not mean the official site is unchanged**:
the workflow treats it as "sync needed" (fail-open) so the full pipeline's own
prechecks and stage gates report the real error.

### Official site adds or deletes a page

A single refresh can both add and delete pages (7.26 added
`wireless/wifi/configuring-meshpoint` and
`firewall-and-quality-of-service/firewall/raw`, and removed `tg-lr-setup-guide`).
Both must be handled by the pipeline itself or every day gets stuck at the same
point:

- **Added page**: `fetch-upstream` assigns `<route>.md` to an official route that
  does not exist locally (instead of hard-failing with "no local path mapping");
  `cache-structure` uses the upstream Markdown as local text while `docs/` does
  not yet contain the file — `materialize` writes that file in a later stage.
- **Deleted page**: a page the official site no longer returns (its `source`
  gives 404/410) is **no longer** treated as a "mirror-owned page" and collected
  into the manifest; it is absent from the manifest and `prune-orphans` then
  deletes the copy in `docs/`. Pages authored by this repository are preserved
  by `corrections/local-pages/<docs_dir>/<route>.md` — the only signal that "this
  page belongs to the mirror", so never delete those files by hand.

### Why dispatch instead of waiting for a push trigger

A push made with the default `GITHUB_TOKEN` **does not** trigger other workflows
(GitHub's recursion rule; `workflow_dispatch` / `repository_dispatch` are the
exceptions). After the sync job pushes its commit it explicitly calls
`createWorkflowDispatch('pages.yml')` against the branch's latest commit —
equivalent to a push trigger, but the build runs only once. If you later switch
checkout/push to a PAT with hub write permission, **remove** that dispatch step or
`pages.yml` will run twice (the second run queued by the `pages` concurrency
group, wasting 14 minutes).

### Manual trigger and troubleshooting

1. Actions → **Sync upstream documentation** → *Run workflow*;
2. check `force` to re-fetch regardless of the ETag (skips the probe and goes
   straight to `--update`);
3. local equivalents:

```bash
node tools/sync/index.mjs --probe     # 0=unchanged 10=sync needed 2=probe failed
node tools/sync/index.mjs --check     # read-only; the existing 3,511 drifts are a known state
node tools/sync/index.mjs --update    # requires a clean work tree (--allow-dirty skips that guard)
git status --porcelain                # non-empty = this sync actually changed something
```

4. on failure the workflow opens an issue titled `sync failed: <run url>` whose
   body links the failed run and includes the last 40 lines of `sync.log`; the
   mirror is never half-updated — a failed run **commits nothing** and the site
   stays on the previous version. Re-run the same workflow after fixing the
   cause; the next cron run also retries automatically.

### Permissions and concurrency

- `permissions`: `contents: write` (commits), `issues: write` (open an issue on
  failure), `actions: write` (dispatch `pages.yml`). `CROSS_REPO_TOKEN` is not
  needed here: the language repositories are handled by `pages.yml`'s
  `publish-content`.
- `concurrency: sync-upstream` (`cancel-in-progress: false`): two syncs never
  overlap, otherwise both would write the same tree and the later push would be
  rejected before rebasing.
- `timeout-minutes: 120`: the first sync fetches the whole corpus (~1.5k pages +
  rendered pages + assets); an ETag hit needs only two HTTP requests.

### Known risks

- **Official site redesign**: the version line in `/llms.txt` and the ETag of
  `/llms-full.txt` are hard dependencies. Failing to read the former makes
  `--probe` exit 2 (fail-open → the full pipeline fails once more and opens an
  issue); if the latter disappears, `--update` falls back to fetching page by
  page — slower, not wrong.
- **The first run is not a 304**: until `upstream/<version>/manifest.json` has a
  `corpus_etag`, a full fetch is inevitable and the ETag is written afterwards;
  only from the second run on do you get the "finishes in seconds" behaviour.
- **Over 120 minutes**: the pipeline aborts on first failure, so a timeout is a
  failure — no commit, issue opened. A rerun repeats the same work, so if things
  are genuinely slow, first run manually with `force` to persist the ETag.
- **Official site inlines images as `data:` URIs — now auto-recovered**: 7.26's
  `getting-started/installation-and-upgrade/packages.md` referenced
  `img/packages1.png`…`packages4.png`, which the official site no longer serves
  at those paths (rendered pages inline them as `data:image/webp;base64,…`).
  `fetch-assets` now fetches a rendered page once, aligns the `.md` image
  references with `<img>` elements in order (by alt text when it is unique),
  decodes and validates the `data:` URI, and writes it back **under the original
  file name from the `.md`** into that page's `img/`; the log
  `recovered N image(s) from rendered data URIs` lists the names. Thumbnail link
  hrefs (`[![](img/a.png)](img/a.png)`) are downloaded too, so `address-images`
  no longer says `refusing to change anything` because of a dangling href.
  Limits: recovery works **only when the rendered page actually provides a
  `data:` URI**; only webp/png/jpeg/gif/svg MIME types with a valid file header
  are accepted (empty bytes or a signature mismatch fail); alignment relies on
  "same image count" or "unique alt", and if neither holds it falls back to
  downloading by URL (still 404 → the usual error, never a silent skip). Unit
  test: `npm run test:sync-assets`.
- **Playwright is required (rendered stages are in the pipeline)**:
  `fetch-blog.mjs` and `fetch-changelog.mjs` use `playwright-core` to render
  articles (shared `tools/sync/lib/render-page.mjs`), while `fetch-hardware.mjs`
  uses plain HTTP + cheerio. `sync.yml` must therefore prepare a browser:
  `CHROME_PATH` pointing at
  `vendor/browsers/chrome-linux64/chrome`, or
  `npx playwright install --with-deps chromium`; otherwise those two stages fail
  at `chromium.launch()`. The three rendered stages run after `fetch-upstream`
  and before `install-version`; a failure aborts the whole sync round.

## Structural gates: lock integrity and cold-start contract

Two hub-only assertions, neither using the network nor writing files, are wired
at the very start of `pages.yml` (`build` job) and `sync.yml` (`sync` job); their
exit codes also feed into the failed/ok calculation of `npm run verify`.

| Command | Assertion | Position |
| --- | --- | --- |
| `npm run lock:check` | lockfileVersion=3; the dependencies / devDependencies of `packages[""]` match `package.json` exactly; every `optionalDependencies` declaration has a corresponding `node_modules/<name>` entry; the number of pagefind platform packages equals its declaration (currently 7) | **before** `npm ci` |
| `npm run verify:cold-start` | `buildStages({firstInstall:true})` yields `19 + archivedVersions().length` stages (currently 21), every archived version has `fetch-archive-<v>` (argv `--version=<v>`), no report-routes / snapshot-version, install-version is kept, materialize argv is `['--all','--write']`; `skippedReleases()` is null-safe; `paths.mjs` uses `currentVersionOrNull()` and does not call the throwing `currentVersion()` at top level; probe fails open with exit 10; archived materialisation artifacts are SKIP until produced, then become hard assertions | before the probe in `sync.yml`; alongside the tooling-drift gate in `pages.yml` |

`lock:check` only reports missing keys — it does **not** repair the lock: fixing
the lock is an explicit operation (`npm install`, then review the diff). The
gate's job is to make "`npm ci` succeeded but a platform package entry is
missing" fail before dependencies are installed.

**Cold-start convention**: when `data/manifests/current-version.json` is absent,
`sync --update` automatically enters `mode=first-install` — first fetch the
target version, then insert one `fetch-archive-<v>` stage for every archived
version in `versions.json` (argv `--version=<v>`, official archive routes),
continue installing the target version (`install-version` kept,
`report-routes` and `snapshot-version` skipped), and finally
`materialize --all --write` materialises 7.26/7.25/7.24 in full. `--probe`
prints `reason=first-install` and **exits 10** (fail-open: the workflow goes to
`--update` instead of mistakenly deciding "the repository is up to date" and
skipping sync). In this state `currentVersionOrNull()` returns `null` while
`currentVersion()` keeps its throwing semantics for callers that really need an
installed tree. If the manifest exists by the time the assertion runs (for
example a full sync is writing it), the null assertion prints SKIP and carries
on, without deleting or changing any artifact.

`pages.yml` itself only builds/publishes and never calls sync: that is why
`verify:cold-start` is there as a cheap structural gate alongside
`check:tools-template` (blocking regressions on every push); the gate that
actually precedes a sync call lives in `sync.yml`.

**Favicon gate**: the `fetch-favicon` stage runs immediately after
`fetch-changelog` (in all three modes: cold-start / bump / refresh), fetches the
real SVG from the official homepage's `<link rel=icon>`, and writes
`static/img/favicon.svg` and `data/manifests/favicon.json`. `npm run verify:favicon`
is a hub-only offline assertion (local sha256/bytes match the manifest; SKIP if
the manifest is missing), wired after `verify:build-inputs` and before `build` in
`pages.yml`, and included in `npm run verify`; run
`node tools/verify/favicon.mjs --online` when you need to compare against the
official bytes. The `check:tools-template` whitelist contains two exact paths:
`tools/sync/fetch-favicon.mjs` (mirrored in the template) and
`tools/verify/favicon.mjs` (hub-only).

## Enabling automatic updates (GitHub settings)

1. **Secret** (hub repository Settings → Secrets and variables → Actions → Secrets)
   - `CROSS_REPO_TOKEN`: fine-grained PAT whose Repository access includes only
     the language repositories and whose Permissions grant only **Contents: Read
     and write**. See
     [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md#7-security-model) for
     how to obtain it, least privilege and rotation.
2. **Variables** (optional): `SITE_URL` / `BASE_URL` are already written in the
   workflow env of `pages.yml`, and `locales.json` carries the same defaults;
   change them only for a fork or a different preview domain.
3. **Language repository**: content arrives via git push, so every content root
   must be git-tracked (`.gitignore` must not ignore `docs/`, `versioned_docs/`,
   `hardware/`, `blog/`, `changelog/`, `data/`, `sidebars*.ts`,
   `versioned_sidebars/`, `versions.json`, `locales.json`); its own `pages.yml`
   handles translate + build + deploy. Migration steps:
   [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md#9-adopting-an-existing-language-repository).

## Suggested order for the first enablement

1. Run **Build and deploy site** once in the hub and confirm the English build
   and deploy pass;
2. run it again with `publish_only` checked, confirm `publish-content` succeeded,
   that a `content: sync from hub <sha>` commit appeared in the language
   repository and that its workflow started;
3. watch the language repository's translate / build / deploy jobs;
4. reproduce locally with `npm run content:publish:dry` (no network) and
   `node tools/content/publish.mjs --only=<tag>`.

## Local equivalent commands

```bash
npm run locales:check                            # validate locales.json (no network)
npm run content:publish:dry                      # print the publish plan (no clone, no push)
CROSS_REPO_TOKEN=… npm run content:publish        # real push (needs a local PAT)
SITE_LOCALE=en ASSET_HOST=true BUILD_HEAP_MB=6144 npm run build
npm run verify:deploy                            # deploy gate: slim → four assertions
```

`verify:assets` (`tools/verify/asset-refs.mjs`) **must run after `build:slim`**:
`slim` deletes `build/<locale>/{img,assets/images,assets/files}` and rewrites the
URLs back to the root copies; without slimming first it only reports "locale
prefixes remain in the artifact". `npm run verify:deploy` fixes that order; when
running an assertion on its own, do not swap the two steps.

## Deployment prerequisite: site addresses

Site addresses have three layers, highest priority first: workflow `env`
(explicit `SITE_URL`/`BASE_URL`/`LOCALE_*` in `pages.yml`) → that locale's
`site`/`baseUrl` in `locales.json` → code defaults. Both `docusaurus.config.ts`
and `tools/lib/site-config.mjs` resolve them through `tools/content/locales.js`,
so the build, `llms.txt`, the slim script and the deploy assertions all see the
same addresses.

The current `pages.yml` fixes the English site address in the workflow env, so
there is no need to create Variables in GitHub; for a fork or a domain change,
edit the workflow env (or the repository Variables). **Do not** change only
`locales.json` and forget the language repositories' `ASSET_ORIGIN`: that would
make every image, PDF and video on the language sites 404. The `build` job sets
`timeout-minutes: 45` (default 360) and uses `concurrency` with
`cancel-in-progress: false` so a new push does not cancel an in-flight deploy.

## Deploy gate (`pages.yml`)

`pages.yml` runs `npm run verify:deploy` after `npm run build` and before
`upload-pages-artifact` (first `slim`, then four assertions); any non-zero exit
stops at the build stage, produces no Pages artifact, and the last successful
deployment keeps serving:

| Step | What it asserts |
| --- | --- |
| `npm run verify:assets` | No locale-prefixed asset references, no double-hash PDF names, and no references to nonexistent files in the artifact or source Markdown |
| `npm run verify:base-url` | Every resource-type root-absolute reference (`img`/`video`/`link`/`og:image`, etc.) is under `baseUrl` |
| `npm run verify:orphan-assets` | Every on-site `/img/<file>` reference has a corresponding file |
| `npm run verify:llms` | Every on-site link in each `llms.txt` in the artifact (site root, each version's `docs/<version>/`) points at an existing artifact file; `llms-full.txt` is checked as a normal target too and fails if `build:slim` removed it |

`verify:llms` (`tools/verify/llms-links.mjs`) covers a kind of broken link the
other assertions cannot see: `llms.txt` contains absolute URL strings rather
than routes, which neither `onBrokenLinks` nor the browser check looks at, so
they must be compared one by one against the post-slim artifact (also requiring
it to run after `build:slim`).

`verify:deploy` already includes `slim` and the four assertions in order — do not
split it into two separate runs: `slim` must come first (see above). The gate
shares the same `SITE_URL`/`BASE_URL` as `build`, otherwise `base-url-refs` would
validate one artifact with the default prefix from `locales.json`; `slim` also
rewrites absolute URLs according to `BASE_URL`, so config-file defaults are not
enough.

## Shared assets (`ASSET_ORIGIN`)

The English site is the **asset host**. A localized site no longer keeps
`static/`: images, PDFs, videos, captured pages and the CLI data stay in the
English repository, and the localized build rewrites its resource references to
that origin.

| `ASSET_ORIGIN` | Behaviour |
| --- | --- |
| unset (English site) | every root-absolute reference gets the local `baseUrl` — unchanged behaviour |
| set (localized sites) | `/img/`, `/assets/`, `/videos/`, `/official/`, `/cli/` become `${ASSET_ORIGIN}/…`; page routes (`/docs/`, `/hardware/`, `/blog/`, `/changelog/`) stay local |

The value is the English **site base address**, not a bare origin: include the
base path and omit the trailing slash
(`https://newwlfz.github.io/mikrotik_manual_i18n`). It is set in the Chinese
repository's `pages.yml`; the English build does not set it.

Where the rewrite happens (the code is byte-identical in both repositories):

- `tools/build/remark-prefix-root-refs.mjs` — raw HTML/JSX attributes *and*
  Markdown image/link destinations. It is also registered in
  `beforeDefaultRemarkPlugins`, otherwise `transformImage` would `require()`
  `![](/img/…)` as a local file and a localized build without `static/` would
  fail.
- `customFields.assetBaseUrl = ASSET_ORIGIN || baseUrl` — `<Img>`, the navbar
  logo, the favicon and `og:image`.
- `tools/build/llms.mjs` — `llms-full.txt` and the generated per-page `.md`
  copies.
- `staticDirectories: []` — a leftover `static/` is **ignored** (the build
  prints a warning), never published.
- `tools/cli/build-all.mjs` — the generated CLI data (~7 MiB) is written to
  `work/cli/` instead of `static/cli/`, so a localized build never recreates
  the tree. `cli-compare.json` is still published at the local site root: it is
  read with `fetch()`, which needs CORS, and the asset host sends no
  `Access-Control-Allow-Origin`.
- `tools/verify/asset-refs.mjs` counts external references and skips local
  existence checks for them; `tools/verify/orphan-assets.mjs` skips the orphan
  scan when `static/img` is absent; `tools/build/slim.mjs` prints
  `external assets: N refs` instead of pruning.

Still deployed locally: the pagefind index (`customFields.localAssetBaseUrl`),
Webpack chunks/fonts and the per-page `docs/**/img` images.

### The hub must keep its full `/img` tree (`ASSET_HOST`)

The English site is not only a reader-facing site, it is also the **host of the
localized sites' assets**, so its deploy shape has one extra requirement:
`ASSET_HOST=true` (set in this repository's `pages.yml`) makes `slim` keep the
complete `build/img` tree (~99 MiB). Without it, `slim` prunes every `/img/<name>`
that no *English* page requests — and English Markdown images are served from
`assets/images`, so almost all of `/img` would be pruned while localized pages
load exactly those `/img/<name>` URLs (404).

The extra ~88 MiB is the price of sharing; the Pages site stays under the 1 GB
budget today. A dedicated asset CDN later would keep the full `static/` tree and
drop this constraint.

**Failure risk.** `ASSET_ORIGIN` couples every localized site to the English
site's URL. Renaming the repository, moving to another domain or changing its
base path breaks images, PDFs and videos on *all* localized sites at once. Any
such move must update `ASSET_ORIGIN` in every localized repository's `pages.yml`
in the same change. A dedicated CDN later needs no code change: point
`ASSET_ORIGIN` at it and copy the `static/` tree there.

Local verification (build the English site once, then verify a localized build
against the hub's public asset origin; the working root's shared server,
`node work/serve-multi-i18n.mjs`, mounts both `build/` trees on port 3030 and
accepts a `PORT` override):

```bash
# English repository: its build/ is served under /mikrotik_manual_i18n/
# Localized repository: build against the hub origin, then run the deploy gate
ASSET_ORIGIN=https://newwlfz.github.io/mikrotik_manual_i18n \
SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_zh_hans/ \
SITE_LOCALE=zh-Hans npm run build
ASSET_ORIGIN=https://newwlfz.github.io/mikrotik_manual_i18n npm run verify:deploy
```

`verify:deploy` must exit 0 with external references: they are counted, not
checked against `build/`.

## Deployment rehearsal (local, no push)

`pages.yml` only runs after a push, but each of its steps can be reproduced
exactly locally. `tools/build/rehearse-pages.mjs` runs build → slim → the four
gates in `pages.yml` order, then packages the artifact the way
`actions/upload-pages-artifact@v3` does (`tar --dereference
--hard-dereference`), finally starts a static server under `baseUrl` to spot-check
URLs, and writes all the numbers to `work/pages-rehearsal.json` (`work/` is
ignored by `.gitignore`, so it is not committed).

```bash
# full flow: build + slim + gates + packaging + URL spot checks + browser-check
SITE_URL=https://newwlfz.github.io BASE_URL=/mikrotik_manual_i18n/ \
  node tools/build/rehearse-pages.mjs

# reuse the existing build: only re-run tar/gzip, URL spot checks and the browser check
node tools/build/rehearse-pages.mjs --skip-build

# skip the last step when Chrome is unavailable (vendor/browsers)
node tools/build/rehearse-pages.mjs --skip-browser
```

A successful rehearsal should show the following (measured on commit
`11cf24f1d`, 2026-11-14):

| Item | Expectation |
| --- | --- |
| `build:lowmem` | exit 0, about 13–14 minutes (6 GiB heap) |
| `build:slim` | exit 0, about 10 seconds |
| the four gates | all exit 0 (about 18 seconds in total) |
| `du -sb build` | ≈ 1.15 GB (1.07 GiB) |
| tar (artifact measure) | ≈ 1.19 GB (1.11 GiB), well below 10 GB |
| `gzip -9` size | ≈ 364 MB (347 MiB), upload reference only |
| files / directories | ≈ 47,900 files / 12,400 directories / 0 symlinks |
| spot-checked URLs | all 13 return 200, with `content-length` matching the on-disk files |
| `node tools/verify/browser-check.mjs` | 29/29 |

tar is about 42,000,000 bytes larger than `du -sb` because of tar's 512-byte
block padding and directory entry overhead, not because the artifact grew.

### A local rehearsal cannot replace a real deployment

- Locally `build:lowmem` is used (6 GiB heap); `pages.yml` uses `npm run build`
  with `BUILD_HEAP_MB` in workflow env (currently 6144), which
  `tools/build/index.mjs` turns into `NODE_OPTIONS=--max-old-space-size=6144`
  — follow `pages.yml` for the current value. The artifacts are the same, but
  **build times are not directly comparable** (this machine has 15 GiB RAM and a
  larger heap would OOM).
- `npm ci` is not run: the existing workspace `node_modules` is reused. Only real
  CI can confirm the dependency tree is exactly `package-lock.json`.
- The static server only simulates path resolution under `baseUrl` (`/`,
  `index.html`, `.html` fallback, 404), not CDN behaviour, compression, HTTP/2
  or Pages' 404 fallback details.
- **Whether the "published site" 1 GB limit is a hard rejection cannot be proven
  locally.** GitHub documents it as a limit for published sites
  ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)),
  but the upload side is only limited by the 10 GB artifact cap; whether
  exceeding it rejects a deploy, causes partial 404s, or only warns can only be
  settled by a real deployment.
- Whether repository Variables (`SITE_URL` / `BASE_URL`) are set cannot be seen
  locally. When both are absent the build falls back to
  `https://mirror.invalid` in `docusaurus.config.ts`, while all four gates still
  pass — they check internal consistency, not whether the domain is real.

If a real deployment is rejected for size, the fallback order (numbers from the
rehearsal) is:

1. drop one archived version (7.24 ≈ 226 MiB → ≈ 872 MiB remaining);
2. keep only current 7.26 (drop 7.24 + 7.25 → ≈ 642 MiB);
3. split Chinese and English into two Pages sites (English ≈ 640 MiB, Chinese ≈ 457 MiB).

A failed Pages publish keeps the last successful deployment, so the site does not
go down immediately; but new content does not go live either, so size must be
resolved before merging rather than discovered at deploy time.

PDF attachment links are always written as raw HTML anchors
(`<a href="/assets/files/<name>.pdf" target="_blank" rel="noopener">…</a>`):
Markdown links get rewritten into `require()` by `mdx-loader`'s `transformLinks`,
and the `otherAssets` loader then adds **another hash** to a file name that
already has a content hash
(`<stem>-<sha>-<sha>.pdf`), doubling the artifact (≈ 60 MB). Anchors bypass
`transformLinks`; the `baseUrl` in `href` is added by
`tools/build/remark-prefix-root-refs.mjs`. The conversion is performed by
`tools/sync/sync-pdfs.mjs` in this repository and
`tools/translate/fix-asset-links.mjs` in the language repository, both calling
`tools/translate/lib/pdf-links.mjs`; both are idempotent (`pdf-links.mjs` is the
shared library kept here, `fix-asset-links.mjs` only exists in the language
repository).

## `script_warning` in a language repo's job summary

The language repositories check every translation against the target locale's
writing system before it is written (their own
`tools/translate/lib/script-check.mjs`, from `templates/locale-repo/tools/`):
`zh-Hant` must not contain Simplified-only characters or mainland terms,
`zh-Hans` is checked in the opposite direction. A hit gets one feedback retry
with the offending forms quoted back; an answer that still fails is kept and
recorded as `script_warning`.

The warning never gates the build — the page is written, committed and deployed
as usual — but it is not silent either:

- the `--json` batch summary carries `script_warning` (count) and
  `script_warnings` (per item `file` / `kind` / `forms` / `sample`);
- `work/translate/run.json` keeps the same records, so the next batch can see
  what the previous one left behind;
- the language repository's `tools/ci/read-translate-summary.mjs` writes
  `script_warning=<count>` as a step output and lists one row per warning under
  the batch table in the job summary.
