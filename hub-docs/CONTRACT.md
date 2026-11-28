# Project process contract (CONTRACT)

> This document writes the mechanisms already landed in the first four layers as
> an **executable written contract**: each item gives the source of truth, the
> command, the assertion, and what to do on failure. Everywhere this document
> says "current state", it is the result of actually reading files / running
> read-only commands in the workspace on 2026-11-22; "contract requirement" is
> an obligation that must be met and must be reported honestly while it is not
> wired up. This document is **documentation** — it does not change code,
> configuration or assertions, does not push, and never reads `.env.local`.
>
> Path convention: paths are relative to the working root that contains the
> checkouts; the hub is `mikrotik_manual_i18n/` and the two language
> repositories are its siblings `../mikrotik_manual_zh_hans` and
> `../mikrotik_manual_zh_hant`. Unless stated otherwise, the commands below run
> at the corresponding repository root. All interfaces are defined by the source
> code; reference documents are
> [FANOUT.md](FANOUT.md), [ARCHITECTURE-MULTISITE.md](ARCHITECTURE-MULTISITE.md),
> [CI.md](CI.md), [PIPELINE.md](PIPELINE.md).

---

## 1. Architecture and sources of truth

### 1.1 Split-repository model (only source of truth = hub)

| Role | Repository | Owns |
| --- | --- | --- |
| hub (`en`) | `newwlfz/mikrotik_manual_i18n` | corrected English source, generated data, navigation/version manifests, **the language registry `locales.json`**, the shared `docusaurus.config.ts`, the publisher; builds the English site only |
| language repository | `newwlfz/mikrotik_manual_zh_hans`, `newwlfz/mikrotik_manual_zh_hant` | their own `i18n/<tag>/` translation overlays, `config/`, `work/`, `tools/`, `src/`, `.github/workflows/pages.yml`; each builds and deploys one locale |
| GitHub Pages | one project site per repository | each one's deployed site; `ASSET_ORIGIN` points at the English site for shared `/img`, `/assets`, `/videos` |

The addresses and online-locale lists of all three consumers are read only from
the hub's `locales.json`, always through `tools/content/locales.js` (CommonJS,
`require()`d by `docusaurus.config.ts` and imported by default by the ESM tools
under `tools/`):

- `docusaurus.config.ts` → `i18n.locales` / `localeConfigs` / language dropdown /
  hreflang / first-visit redirect / `<meta name="docusaurus-available-locales">`;
- `tools/lib/site-config.mjs` → `siteUrl` / `baseUrl` for the build, llms.txt,
  slim and the deploy assertions;
- `tools/content/publish.mjs` → decides which language repositories receive
  content.

The header comment of `tools/content/locales.js` states explicitly that
`docusaurus.config.ts` and the tools **must not keep a second list**;
`guides/FANOUT.md` §1 likewise requires the language repository list and their
addresses to be read only from the hub's `locales.json` (`repo` field).

### 1.2 The `locales.json` contract

Current facts (`locales.json`, 3 records, `default: "en"`):

| Field | Meaning / rules |
| --- | --- |
| `default` | must be `en` (the hub itself) |
| `<tag>.label` | non-empty display name; `repo` is `owner/name` and unique per locale; `baseUrl` starts and ends with `/`; `site` is an absolute http(s) URL ending with `baseUrl` (`siteTitle` / `tagline` drive the title and llms.txt) |
| `<tag>.available` | **global online snapshot**: optional boolean; when absent, `available !== false` means online. The online set = `availableLocales(registry)`, which determines every site's `i18n.locales`, dropdown, hreflang, redirect and build meta. A locale with `available:false` stays registered but appears on no site. Validation requires at least one `available !== false` and that `default` is available |
| shared key fields | `locales.json` is published from the hub to every language repository, but only the key fields (`default` plus each locale's `repo`, `baseUrl`, `site`, `available`) must agree; `tagline`, `label` and `siteTitle` are localized per site and are **not** asserted byte-for-byte. Any `available` flip is still a **global event** that must trigger fan-out and rebuilds across all repositories |

Verification commands (read-only, offline):

```bash
npm run locales:check          # tools/content/check-locales.mjs; validates default/baseUrl/repo/site/label
node tools/content/fanout-check.mjs --check   # key fields of locales.json + byte identity of sidebars-hardware.ts/hub-docs + build meta catching up
```

Measured today: `locales:check` exits 0 (3 locales, available =
`["en","zh-Hans","zh-Hant"]`), and the `locales.json` **key-fields signature**
`a02a1a8da428f354…` is equal in all three repositories; the whole-file sha256
differs (`ca2c55ea95d489a6…` hub vs `e9d65d0eb6f90df7…` language repos)
because the taglines are localized. `hub-docs` is still missing in the two
language repositories (待 publish), so `identity=2 presence=2`; see
`work/fix-fanout-docs/04-real-check-after-fix.txt`.

### 1.3 hub-owned / language-repository-owned

The contract constants live in `tools/content/sync-contract.mjs` (**the only
copy**; the publisher `publish.mjs` and the assertion `fanout-check.mjs` both
import from it — writing a second copy is forbidden):

- `CONTENT_ROOTS` (11, directories replaced wholesale / single files
  overwritten):
  `docs/`, `hub-docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`,
  `data/`, `sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`,
  `versions.json`. `hub-docs/` is the English README + shared guides source
  that the language repository translates into
  `i18n/<locale>/docusaurus-plugin-content-hub-docs/`.
- `REGISTRY_FILE = 'locales.json'`; `EXPECTED_SYNC_LIST = CONTENT_ROOTS + REGISTRY_FILE` (12 items).
- `BYTE_IDENTICAL_ENTRIES = [sidebars-hardware.ts, hub-docs]`: these two must be
  byte-identical in all three repositories. `locales.json` is asserted on its
  key fields only (`default`, `repo`, `baseUrl`, `site`, `available`) because
  `tagline` / `label` / `siteTitle` are localized. The other content roots are
  rewritten in place by each language's translation stage on arrival, so only
  "presence" is asserted for them.
- `BUILD_META_FILE = 'build/index.html'`, `BUILD_META_TAG = 'docusaurus-available-locales'`.

The hub does **not publish** `static/` (it is the asset host; language sites
reference it through `ASSET_ORIGIN`), and the publisher **never touches** the
target repository's `i18n/`, `config/`, `work/`, `tools/`, `src/`, `.github/`
(see the header of `publish.mjs` and `ARCHITECTURE-MULTISITE.md` §2). A language
repository's own `i18n/` overlays, `config/`, TM and checkpoints belong to it;
the hub must not overwrite them.

The authoritative copy of the shared toolchain is
`templates/locale-repo/tools/`: `npm run sync:tools -- --to
../repo_<slug> --dry-run` / `--all` (conflicts are not overwritten by default;
`--force` is required), and `npm run check:tools-template` uses the `WHITELIST`
in `tools/verify/tools-template.mjs` to record every permitted difference (each
with a reason); unexpected diffs must be empty.

---

## 2. Hub-change fan-out contract

### 2.1 When `content-fanout` must be dispatched

From the trigger matrix in `guides/FANOUT.md` §2:

| Hub change | What must be pushed | What must be rebuilt | Why |
| --- | --- | --- | --- |
| Any `available` flip in `locales.json`, or an address / label change | `locales.json` in every non-default repository (plus content roots) | **all repositories** (including the hub) | Every site derives `i18n.locales`, dropdown, hreflang and first-visit redirect from its own registry |
| A structural change to `sidebars-hardware.ts` / `sidebars.ts` / `versions.json` / `versioned_sidebars/` | The corresponding file in every language repository | **all** | Each site builds its own navigation; missing one means a 12/13-category drift |
| A content-root change such as `docs/` | The corresponding root in the target language repository | the pushed language repositories (the hub is triggered by its own push) | Only that site's content is affected |
| Registry/structure and content changes together | everything | **all** (union) | building once more is preferable |

`tools/content/publish.mjs` uses `changedEntries` (a `sha256Entry` comparison of
each sync item before and after the copy) to decide `globalChange`: when
`changedEntries` contains `locales.json` or `sidebars-hardware.ts`, the printed
`需重建` list covers **all** locales; otherwise only the targets named by
`--only`. That list and `fanout-check`'s `collectFanout()` come from the same
contract, so they cannot contradict each other.

### 2.2 Why push self-triggering is not enough and an explicit dispatch is required

- **GitHub recursion rule**: a push made with `GITHUB_TOKEN` does not trigger
  other workflows (documented in the header of `.github/workflows/sync.yml` and
  FANOUT.md §2); `workflow_dispatch` / `repository_dispatch` are the exceptions.
  `publish.mjs` commits cross-repository with `CROSS_REPO_TOKEN`, so it likewise
  needs an explicit dispatch of the target repositories' `pages.yml`.
- **Translation-progress commits carry `[skip ci]`**: the language
  repositories' `pages.yml` uses
  `git commit -m "translate: batch (pending …) [skip ci]"`, and UI string and
  patch commits carry `[skip ci]` too, so their own push does **not** start
  another translation round; further rounds can only be driven by a schedule,
  `workflow_dispatch`, or new hub content.

### 2.3 Event name and payload (the interface follows FANOUT.md §3)

The event name is fixed as `content-fanout`, and `client_payload` carries data
only, never credentials:

```json
{
  "repo": "newwlfz/mikrotik_manual_zh_hans",
  "slug": "zh-Hans",
  "reason": "locale registry available flip: zh-Hant=true",
  "hub_sha": "<hub HEAD sha>",
  "trigger": "content:publish",
  "changed": ["locales.json", "sidebars-hardware.ts"],
  "locales": ["en", "zh-Hans", "zh-Hant"],
  "fanout_sha": "<hub commit sha pushed to the target repo>"
}
```

Field meanings: `repo` is byte-identical to the hub registry's `repo`; `slug` is
the locale key; `reason` states which locale's `available` changed to what, or
which structural file changed; `hub_sha` / `fanout_sha` are traceable to commits;
`changed` may only list actual changes within `EXPECTED_SYNC_LIST`; `locales`
covers every locale in this rebuild (all for a global change, otherwise the
pushed ones). Equivalent REST call:

```bash
curl -X POST \
  -H "Authorization: Bearer $CROSS_REPO_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/newwlfz/mikrotik_manual_zh_hans/dispatches \
  -d '{"event_type":"content-fanout","client_payload":{"repo":"newwlfz/mikrotik_manual_zh_hans","slug":"zh-Hans","reason":"locale registry available flip: zh-Hant=true","hub_sha":"<sha>","changed":["locales.json"],"locales":["en","zh-Hans","zh-Hant"]}}'
```

Credential: the hub Actions secret `CROSS_REPO_TOKEN` (fine-grained PAT with
`Contents: read and write` on the target repositories and write access to
Actions for dispatching; the value is never printed). The target repository's
`pages.yml` declares `on.repository_dispatch`. **Wiring status (verified on
disk)**: the hub's `publish-content` job validates the registry, checks the
token, runs `node tools/content/publish.mjs` and then dispatches
`content-fanout` to all three repositories; both language `pages.yml` files
declare `repository_dispatch: types: [content-fanout]`. `publish.mjs` itself
still only prints the `需重建` list — the dispatch is the workflow's job, not
the script's. The remaining gap is elsewhere: `fanout-check` runs in the hub's
local `npm run verify` but in **no** `.github/workflows/*` job, so CI is not
fail-closed on fan-out drift.

### 2.4 Local publisher interface (`publish.mjs`)

```bash
node tools/content/publish.mjs --dry-run                  # read-only plan; no token needed
node tools/content/publish.mjs --only=zh-Hans             # no token -> local copy simulation
node tools/content/publish.mjs --only=zh-Hans --local     # explicitly force the simulation
node tools/content/publish.mjs --message='content: sync from hub {sha}'
```

`--dry-run` prints the plan without network / clone / commit / push; `--only`
can be repeated; without a token it automatically switches to the local
simulation (copy the 12 items to a temporary directory and delete it, print
`需重建` with the same `collectFanout()`, exit 0); a real run clones each
repository → overwrites the 11 roots + `locales.json` → commits/pushes only when
`git status` shows a difference (idempotent); failures are isolated per
repository and any failure makes the overall exit 1. npm aliases:
`npm run content:publish`, `npm run content:publish:dry`.

### 2.5 What the language repository does on receipt / schedule backstop

The language repository's `pages.yml` rebuild chain: `translate` (precheck → one
translation batch → commit progress) → `build` (pending==0 / gate pass → content
root assertions → `translate:verify` → build → `verify:deploy`) → `deploy`. After
the rebuild, re-run `fanout-check` so the `docusaurus-available-locales` meta in
`build/index.html` catches up with the registry (an assertion requirement, not
optional cleanup).

**Contract requirement**: dispatch is the primary path; there must be a
periodic backstop so missed dispatches / unfinished multi-round translations are
eventually driven, with residual drift detected by `fanout-check` inside `npm run
verify`. **Current wiring** (verified by reading the workflows):

| Repository | schedule | Purpose |
| --- | --- | --- |
| hub `sync.yml` | `cron: '0 3 * * *'` | daily 03:00 UTC probe of the official site and dispatch of this repository's `pages.yml` |
| `zh-Hant/pages.yml` | `cron: '17 */2 * * *'` | drives one translation round every 2 hours at UTC :17 (90-minute budget + margin; `[skip ci]` prevents self-triggering) |
| `zh-Hans/pages.yml` | `cron: '17 */2 * * *'` | same cadence as zh-Hant |
| fan-out rebuild | wired | hub `pages.yml` `publish-content` dispatches `content-fanout`; both language `pages.yml` declare `on.repository_dispatch.types: [content-fanout]` |
| fan-out drift detection | local only | `fanout-check` is in the hub's `npm run verify` step list; **no CI workflow invokes it yet**, so do not call CI fail-closed |

### 2.6 Assertion-layer interface

`tools/content/sync-contract.mjs` exports: `CONTENT_ROOTS`, `REGISTRY_FILE`,
`EXPECTED_SYNC_LIST`, `BYTE_IDENTICAL_ENTRIES`, `BUILD_META_FILE`, `BUILD_META_TAG`,
`sha256File(file)`, `sha256Entry(entryPath)` (a file's own sha; for a directory,
a sorted `<relative>\t<sha>` listing is hashed), `resolveRepositories(registry, reposRoot)`,
`availableFrom(registry)`, `readBuildMeta(repoPath)`,
`collectFanout({hubPath, reposRoot = path.dirname(hubPath)})`. The last one
produces `identity/presence/buildMeta/rebuild/ok/counts` for shared use by the
assertion and the local simulation.

```bash
node tools/content/fanout-check.mjs            # default --check, human-readable report
node tools/content/fanout-check.mjs --json     # machine-readable; exit-code semantics unchanged
node tools/content/fanout-check.mjs --repos-root=<你的工作根目录>   # 真实例子：/home/evan/mikrotik_manual_i18n
```

Any failure exits 1: ① the **key fields** of `locales.json` (`default`, `repo`,
`baseUrl`, `site`, `available`) agree in all three repositories — `tagline`,
`label` and `siteTitle` are localized and ignored; ② the sha256 of
`sidebars-hardware.ts` and of `hub-docs` are equal in all three; ③ each
repository's build meta equals **in order** the `availableLocales` derived from
its own registry; ④ all 12 `EXPECTED_SYNC_LIST` items exist in each repository;
⑤ the registry is valid and at least one locale has `available !== false`. It
reads only local files, never reads `.env.local` and never uses the network.
It is wired into the step list of the hub's `tools/pipeline/verify.mjs` (after
`hardware-fidelity`), so `npm run verify` uses cross-repository consistency as
a **local** release gate; no `.github/workflows/*` job calls it yet. The locale
repositories' and template's verify do not include this step (they have no
three-repository view), and the hub is inside the `tools/content/` directory
covered by the `check:tools-template` whitelist.

---

## 3. Translation and publishing contract

### 3.1 Batched translation (budget / checkpoints / progress commits / TM retention)

The language repositories' `pages.yml` `translate` job (identical in both):

1. **Precheck**: `npm run --silent verify:llm -- --quick` (`max_tokens=8`) to
   surface 401/402/403/429 before spending money on a batch; the precheck step
   itself always exits 0, and `gate` decides whether to proceed.
2. **One batch**: `npm run translate:batch -- --apply --budget-minutes=<90> [--max-blocks=N]
   --json`; output `translated/pending/stopped` (`done|budget|signal|error`). At
   the budget deadline it stops gracefully and persists; the job's
   `timeout-minutes: 120` is only a backstop.
3. **Progress commits**: `i18n/`, `work/translate/` and `state/` are committed
   back to `main` with the message
   `translate: batch (pending N) [skip ci]`; each run checks out the branch's
   latest commit and resumes from `work/translate/checkpoint.json` + the
   committed overlays / TM shards, with the planner recomputing each time.
4. **TM retention in git**: `work/translate/README.md` defines the baseline
   committed to the repository
   (`translation-memory.json`, `model-memory.json`, `keep-english.json`,
   `comment-memory.json`, `state/translation-state.json`) and the only carrier
   for new translations after the baseline: `work/translate/shards/*.json`; a
   batch does **not rewrite** the large baseline, avoiding a 26 MB diff per
   batch. Derived artifacts (`tm-global.*`, `table-memory.json`, `usage.jsonl`)
   are not committed.
5. **Checkpoint assertion**: `tools/verify/checkpoint.mjs` (present in the
   template and all three checkouts) validates schema/limit/stopped,
   `deadline - elapsed >= 0`, the existence of
   `run.json` / state / shards, non-decreasing TM entries, and
   `llm_translated + tm_reused == translated`. Without a checkpoint it is SKIP.

### 3.2 Multi-round schedules and manual exceptions

- Rounds are driven by `schedule` (`17 */2 * * *` UTC in both zh-Hans and
  zh-Hant) or `workflow_dispatch`, each resuming from the checkpoint until
  `pending == 0`. `content-fanout` also starts a round (see §2.5).
- `skip_translate` (default false): skips the `translate` job but **not
  verification** — build still runs the content-root assertions and `npm run
  translate:verify` (`build.if` checks
  `needs.translate.result == 'skipped'`); used to fix secrets or re-push content.
- `publish_on_llm_error` (default false): applies only to 401/402/403/429. By
  default no pass → the translate job fails, build is skipped and the live site
  keeps the old version; when checked, `tools/ci/gate-translate.mjs` outputs
  `gate=pass`, build publishes with the already committed overlays, **untranslated
  content goes live in English**, and the job summary records
  `⚠️ 本次为放行发布` plus `llm_error`/`pending` and a `::warning`. Other LLM
  failures (timeouts, 5xx, missing configuration) never pass.
- `gate-translate.mjs` always outputs three items `llm_error` /
  `publish_allowed` / `gate=pass|fail`; the workflow fails when
  `steps.gate.outputs.gate != 'pass'` (fail-closed, so a crashed gate is not
  treated as a pass). The build's `if` also requires
  `needs.translate.result != 'failure'`; deploy only accepts
  `needs.build.result == 'success'`.

### 3.3 The only release criterion (answer to "build success == deliverable?")

**No.** `npm run build` exiting 0 only proves Docusaurus rendered the current
tree; it does not prove translation is complete or content gates passed. Release
is decided uniformly by `tools/ci/release-gate.mjs` (identical sha256
`9761c25e4d1550d4266b7a246a3d5a1ebacfa56eab2dac5294a12481a1779e10` in hub /
zh-Hans / zh-Hant / template):

```
release=pass  ⟺  pending == 0
               && translate:verify exit == 0
               && verify:deploy exit == 0
               && every --gate=NAME:EXIT has exit == 0
               && checkpoint.stopped ∈ {done, budget, signal} (or not_applicable)
               && the checkpoint assertion exited 0
```

A check that is unknown (for example no result supplied with `--no-run`) counts
as a failure; an English-source repository without `translate:pending` /
`translate:verify` (`hasTranslateChain=false`) is N/A (satisfied), and no
checkpoint is SKIP. Failure output gives exact outstanding numbers:
`untranslatedBlocks`, `untranslatedHeadings`, `untranslatedAdmonitions`,
`descriptionEnglish`, `overlayInflation`, `anchorMismatch`, `mdxErrors`,
`structural`.

`untranslatedBlocks` **is part of the verify failure condition**:
`tools/translate/lib/verify.mjs` counts untranslated prose blocks per section in
`report.totals.untranslatedBlocks` (whole-page exclusions are subtracted via
`config/translation-exclusions.yml` / `isTranslationExcluded`);
`printVerifyReport()` in `tools/translate/index.mjs` decides exit 1 from
`untranslatedBlocks + untranslatedHeadings + descriptionEnglish + overlayInflation +
anchorMismatch` together with structural / mdxErrors ("clean headings + lots of
English prose" no longer counts as complete translation). Verified with a
two-way fixture: one remaining untranslated prose block → exit 1; translated
into Chinese → exit 0.

### 3.4 release-gate interface

```bash
# local rehearsal (the script runs all checks itself; do not substitute a bare npm run build)
node tools/ci/release-gate.mjs --json

# CI reuses already collected results (any non-zero content gate exits 1)
node tools/ci/release-gate.mjs \
  --pending-json="$RUNNER_TEMP/pending.json" \
  --translate-verify-exit="$VERIFY_EXIT" --verify-log="$RUNNER_TEMP/translate-verify.log" \
  --verify-deploy-exit="$DEPLOY_EXIT" \
  --checkpoint-stopped="$CHECKPOINT_STOPPED" --checkpoint-exit="$CHECKPOINT_EXIT" \
  --gate="verify:cli:$CLI_EXIT" --gate="verify:images:$IMAGES_EXIT" --json
```

Other arguments: `--repo=DIR`, `--no-run` (only judge supplied values, leaving
the rest unknown), `--pending=N`, `--checkpoint-json=PATH`, `--help`. The script
has no npm alias — call it with `node`. A read-only `--no-run --json` demo
(measured today): the hub gets `release=fail` because
`verify:deploy exit=unknown (must be 0)`, exit 1 — unknown means failure; no
threshold is relaxed.

---

## 4. Unified verification method (the only deliverable criterion)

**Contract clause**: a build is deliverable only if (a) it went through the CI
gates (all assertion steps in the hub `pages.yml` / language repository
`pages.yml` are green), or (b) it explicitly passed locally via
`node tools/ci/release-gate.mjs` (`release=pass`, exit 0).
**Forbidden**: running a local rehearsal with a bare `npm run build` and treating
the `build/` artifact as deliverable; build success is not translation
completeness, nor content/asset gate success, nor cross-repository consistency.

Local acceptance command sequence (in order; stop on any non-zero exit and fix
the cause — do not change assertions or thresholds):

```bash
# ── hub (English source + cross-repository consistency) ────────────────────────────────────────
cd mikrotik_manual_i18n                       # hub checkout, from the working root
npm run locales:check                       # registry validity
npm run lock:check                          # package-lock integrity (before npm ci)
node tools/content/fanout-check.mjs --check # registry/structure/build-meta consistency in all three repositories
npm run verify                              # pipeline/verify.mjs: includes fanout-check, hardware fidelity, etc.
node tools/ci/release-gate.mjs --json       # unified release decision (runs verify:deploy etc. itself)

# ── language repository (zh-Hans shown; zh-Hant identical) ──────────────────────────────
cd ../mikrotik_manual_zh_hans                 # language checkout, sibling of the hub
node tools/translate/index.mjs pending --json   # pending must be 0
npm run translate:verify                        # outstanding items such as untranslatedBlocks must be 0
npm run verify                                  # pipeline/verify.mjs (includes translate:verify)
npm run build
npm run verify:deploy                           # slim + asset/base-url/orphan/llms
node tools/ci/release-gate.mjs --json           # only release=pass counts as deliverable
```

`verify` is the ledger for "is the mechanism landed":
`tools/pipeline/verify.mjs` aggregates the exit codes of all assertions, exits 1
if any is non-zero, and the hub's last step is
`node tools/content/fanout-check.mjs --check`. `npm run verify` fails while the
build meta has not been rebuilt — fail-closed **locally** by design; the fix is
to dispatch a rebuild, not to change an assertion or threshold. The same gate is
not yet wired into a CI workflow, so an Actions run does not currently fail on
fan-out drift.

---

## 5. The trio specification: data/config + pipeline stage + assertion

**Rule**: a mechanism counts as "landed" only when it has all three: ①
data/configuration (reviewable bytes), ② a pipeline stage (which command runs at
which moment), ③ an assertion (non-zero on failure, naming the exact
difference). Missing any one means unfinished. Fixing a problem may only change
data or the pipeline, never an assertion threshold.

| Mechanism | Data / configuration | Pipeline stage | Assertion (command) |
| --- | --- | --- | --- |
| **lock** | `package.json` + `package-lock.json` (including pagefind's 7 platform optionalDependencies) | `npm run lock:check` **before** `npm ci` in hub / language `pages.yml` | `tools/verify/lock-integrity.mjs`: A root deps agree; B every optional dep has a `node_modules/<name>` entry; C the pagefind platform package count is 7. Read-only |
| **anchors** | `tools/translate/lib/anchors.mjs` writes English heading ids into Chinese headings `## 配置示例 {#config-example}`; `upstream/<v>/structure/pages/*.md.json` table caches | translation batch `--apply` persists them; hub `materialize` / table-structure restoration | language repository's `npm run verify:anchors`; hub's `npm run verify:anchor-fidelity` (reports lostAnchor); `translate:verify`'s `anchorMismatch` counts as language debt |
| **fanout** | `tools/content/sync-contract.mjs` (11 roots + 12 items + 2 byte-identical + `locales.json` key-fields identity + build meta tag), `locales.json` | `publish.mjs` (clone→overwrite→commit→push→print rebuild list) → hub `pages.yml` dispatches `content-fanout` → each repository's `pages.yml` rebuild | `node tools/content/fanout-check.mjs --check` (in the hub's local `npm run verify`, **not in CI yet**); `npm run check:tools-template` keeps the toolchain from drifting |
| **pdf-notice** | the notice sentence after the front matter of each `hardware/**.md` + the `pdf_notice` field in `data/manifests/hardware.json` | hub `tools/sync/fetch-hardware.mjs` injects it from `p.pdf-download` in the official rendered HTML (sharing the fetch concurrency pool; skipped when already present) | `node tools/verify/pdf-notice.mjs --check` (offline lower bound of 36 pages, position/manifest audit), `--online --limit=N`, `--self-test`; **not wired yet** into an npm script / `pipeline/verify.mjs` — run it directly |
| **gate** | `tools/ci/gate-translate.mjs`, `tools/ci/release-gate.mjs` (same sha in four repositories), `skip_translate` / `publish_on_llm_error` inputs, `work/translate/checkpoint.json` | translation job's `gate` step → build `if` → `deploy` only on build success; locally via `release-gate.mjs --json` | `gate=pass` and `release=pass`; outstanding items such as `translate:verify`'s `untranslatedBlocks` must be 0; checkpoint assertion exits 0; unknown always fails |
| **toolchain sync** (cross-cutting) | `templates/locale-repo/tools/` is the authoritative copy | `npm run sync:tools -- --to ../repo_<slug>` (conflicts not overwritten; `--force` required to write) | `npm run check:tools-template` (WHITELIST with reasons, unexpected must be 0) |

---

## 6. New-locale checklist (from scaffold to deploy)

Using `ru-RU` as the example; all commands run locally, **push / creating the
remote repository requires a human**.

| # | Step | Command / action | Verification command |
| --- | --- | --- | --- |
| 1 | scaffold + registration | `npm run locale:add -- --code ru-RU --label Русский --site-title … --tagline … --dry-run`, then drop `--dry-run` once confirmed; the script copies `templates/locale-repo/`, replaces placeholders, runs `git init -b main`, writes `locales.json` and runs `locales:check` (rolling the registry back on failure) | `npm run locales:check` |
| 2 | manual production-side work | follow the checklist printed by the script: create the GitHub repository; add `repo` to the `CROSS_REPO_TOKEN` PAT's repository list (`Contents: read/write`); set the `LLM_*` variables/secret in the language repository; `git remote add origin …` and push for the first time; sync the toolchain from the template | `npm run sync:tools -- --to ../repo_ru_ru --dry-run`; `npm run check:tools-template` |
| 3 | `available` flip | edit hub `locales.json`: `ru-RU.available: false → true` (keep `false` until published; an absent field is equivalent to `true`, so "planned" must be written explicitly as `false`). A flip is a global event | `npm run locales:check`; `npm run content:publish:dry` |
| 4 | fan-out (push content + registry) | with a token: `node tools/content/publish.mjs --only=ru-RU` (for a global change, omit `--only` and push all); rehearsal without a token: `node tools/content/publish.mjs --only=ru-RU --local`. Dispatch `content-fanout` to **all** repositories (including the hub) per FANOUT.md §3, with `locales.json` in `changed` | `node tools/content/fanout-check.mjs --check` (identity/presence should clear; FAIL on build meta before rebuild is expected) |
| 5 | push hub changes | manually `git push` the hub's registry/structure/content commits; confirm the `publish-content` job completed; the schedule (`sync.yml`, 03:00 UTC) is the backstop | Actions log + the `需重建` list from `node tools/content/fanout-check.mjs --json` |
| 6 | translation rounds | repeatedly run the new repository's `pages.yml` `schedule` (model it on zh-Hant's `17 */2 * * *`) or `workflow_dispatch` (`budget-minutes=90`, `max-blocks` for debugging); each batch commits `i18n/`, `work/translate/`, `state/` with `[skip ci]` | `node tools/translate/index.mjs pending --json` → `pending=0`; `npm run translate:verify` → exit 0; `node tools/verify/checkpoint.mjs` (when present) → exit 0 |
| 7 | release gate | after translation, do local acceptance or wait for the CI gates | `node tools/ci/release-gate.mjs --json` → `release=pass` / exit 0; `untranslatedBlocks=0` |
| 8 | build + deploy | `npm run build` → `npm run verify:deploy` → `deploy` job (deploys only on build success); after the rebuild, the registry-derived `availableLocales` goes into the build meta | `node tools/content/fanout-check.mjs --check` (all green, `需重建 (0)`); live sites' dropdown/hreflang include the new locale |

> Note: step-4 dispatch and step-6 `17 */2 * * *` schedules are wired (see
> §2.3 / §2.5). What is **not** wired is `fanout-check` in a CI workflow: it
> only runs in the hub's local `npm run verify`. Do not report CI fail-closed
> on fan-out drift until a workflow actually calls it.

---

## 7. Common drifts and troubleshooting

Unified order of investigation:

```bash
node tools/content/fanout-check.mjs --json      # inspect the four groups: identity / presence / buildMeta / rebuild
npm run verify                                  # see which assertion failed (do not change a threshold)
```

### 7.1 Drift 1: registry (`locales.json`)

- **Symptom**: `locales.json [key fields only] FAIL` in `fanout-check`'s
  `identity`, listing a language repository's key-fields signature different
  from the hub's; or a build meta deriving `["en","zh-Hans"]` while the hub is
  already at three locales. Different `tagline` / `label` / `siteTitle` alone is
  **not** a symptom — those are localized on purpose.
- **Cause**: after `locale:add` / manually flipping `zh-Hant.available` to
  `true`, only the new repository was pushed; another repository's `locales.json`
  key fields (`repo` / `baseUrl` / `site` / `available` / `default`) drifted
  (problem 1 in FANOUT.md §1).
- **Fix**: re-publish `locales.json` from the hub
  (`node tools/content/publish.mjs --only=<locale>` or all repositories) so the
  key fields agree again — **never hand-edit a registry in a language
  repository**; then dispatch all repositories to rebuild. Fixture evidence:
  differing taglines/labels → `PASS identity=0`; a `baseUrl` drift →
  `FAIL identity=1 rebuild=1` (`work/fix-fanout-docs/01-*` / `02-*`).

### 7.2 Drift 2: structure (`sidebars-hardware.ts`)

- **Symptom**: `sidebars-hardware.ts FAIL` in `byte identity`;
  `node tools/verify/hardware-fidelity.mjs` reports
  `sidebar has 13 categories` failing (still 12), or
  `npm run verify:anchor-fidelity` reports lost table anchors.
- **Cause**: the hub's 13-category Quick Guides fix landed after the last
  Simplified Chinese push, leaving that repository's `sidebars-hardware.ts` at
  the old 12 categories (problem 2 in FANOUT.md §1).
- **Fix**: re-publish the hub's `sidebars-hardware.ts`,
  `hardware/quick-guides/`, `sidebars.ts`, `versions.json` and
  `versioned_sidebars/` to every language repository (directories replaced
  wholesale), remove old Quick Guide pages duplicated by the new slugs (g1
  deleted 13 duplicate pages to avoid duplicate Docusaurus routes), then
  dispatch all repositories to rebuild. Live sha (g1):
  zh-Hans `b018e0c6592feb6b… → 74e43c7680ebb1fe…`.

### 7.3 Drift 3: build artifacts (build meta)

- **Symptom**: `build meta` section `FAIL` in `fanout-check`, e.g.
  `expected=["en","zh-Hans","zh-Hant"] actual=["en","zh-Hans"]`, with the
  corresponding repositories listed under `需重建`.
- **Cause**: the registry flipped but the site has not been rebuilt; the
  `docusaurus-available-locales` meta in `build/index.html` still holds the old
  value. This is a **real failure**, not noise.
- **Fix**: dispatch the target repositories' `pages.yml` to rebuild per §2.3
  (use `workflow_dispatch` if needed) and re-run `fanout-check` afterwards.
  **Do not** hand-edit `build/index.html` or change the assertion threshold.
  Measured today (recorded in `work/g5-contract/fanout-check.txt`):
  `identity=0 presence=0 buildMeta=2 rebuild=2`, with FAIL on `en` and `zh-Hans`
  and PASS on `zh-Hant`.

### 7.4 Other known gaps (report honestly, do not disguise them as done)

- `fanout-check` is in the hub's local `npm run verify` but in **no** CI
  workflow; Actions does not fail on fan-out drift yet. This is the remaining
  part of problem (1) and is outside the documentation/script edit scope.
- `hub-docs` is missing in both language checkouts (`identity=2 presence=2`),
  i.e. awaiting the next publish; do not change the assertion to make it pass.
- `tools/verify/checkpoint.mjs` and the `17 */2 * * *` schedules are present in
  all three checkouts; keep the toolchain aligned with
  `npm run check:tools-template` (unexpected diffs must be 0).
- the `pdf-notice` assertion currently needs a direct
  `node tools/verify/pdf-notice.mjs --check` and is not wired into
  `pipeline/verify.mjs`; until it is, do not claim it is part of the overall
  gate.

---

## Appendix: today's read-only verification record

Evidence files (written only into the permitted log directory):
`work/fix-fanout-docs/` (under the working root, a sibling of the hub checkout):

- `04-real-check-after-fix.txt` / `.json`: `node tools/content/fanout-check.mjs
  --check` (exit 1): `identity=2 presence=2 buildMeta=0 rebuild=2`; only the
  two missing `hub-docs` entries remain.
- `01-fixture-tagline-pass.txt`: fixture with localized taglines/labels →
  `PASS identity=0 presence=0 buildMeta=0 rebuild=0` (exit 0).
- `02-fixture-keydrift-fail.txt`, `03-fixture-availdrift-fail.txt`: key-field
  drift (`baseUrl`, `available`) → `FAIL identity=1` (exit 1); the threshold
  for key fields is unchanged.

This document changed no source file / configuration / assertion, never read
`.env.local`, and executed no git commit/push.
