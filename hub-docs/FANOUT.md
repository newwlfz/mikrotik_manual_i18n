# Hub → language repository fan-out and cross-repository consistency assertions

> This document is a **specification** (this layer does not change any workflow). The
> actual `pages.yml` dispatch wiring is delivered by the change that owns the workflow
> work; this file defines the behaviour, payload and assertions it must implement so
> that any hub change propagates reliably to every language repository and can be
> proven by a machine.

## 1. Root cause and contract

The hub (`newwlfz/mikrotik_manual_i18n`) is the only source of truth. Both incidents
came from the same gap:

- after `locale:add` flipped `zh-Hant.available` to `true`, only the new repository
  was pushed; `locales.json` in `en` / `zh-Hans` was not rebuilt, so the three
  registries drifted (inconsistent language dropdowns / hreflang / first-visit
  redirects);
- a hub-side fix to the 13-category Quick Guides structure landed after the last
  Simplified Chinese push, leaving `sidebars-hardware.ts` there stuck at the old
  12 categories.

The single-source-of-truth contract lives in `tools/content/sync-contract.mjs`
(**the only copy**; both the publisher and the assertion import from it, so the
two cannot drift apart):

| Item | Content | Semantics |
| --- | --- | --- |
| `CONTENT_ROOTS` (11) | `docs/`, `hub-docs/`, `versioned_docs/`, `hardware/`, `blog/`, `changelog/`, `data/`, `sidebars.ts`, `sidebars-hardware.ts`, `versioned_sidebars/`, `versions.json` | Directories are replaced wholesale and single files are overwritten; a language repository's `i18n/` overlays, translations and configuration are never overwritten |
| `REGISTRY_FILE` | `locales.json` | Published from the hub; only `default` / `repo` / `baseUrl` / `site` / `available` must agree — `tagline` / `label` / `siteTitle` are localized. An `available` flip is a global event |
| `EXPECTED_SYNC_LIST` (12) | the 11 items above + `locales.json` | The "expected sync list" shared by the publisher and the assertion |
| `BYTE_IDENTICAL_ENTRIES` (2) | `sidebars-hardware.ts`, `hub-docs/` | Must be byte-identical in all three repositories; `locales.json` is asserted on key fields only; the other roots are rewritten in place by each language's translation stage, so only "presence" is asserted for them |

The language repository list and repository addresses are read **only** from the
hub's `locales.json` (the `repo` field); no second copy exists in a workflow, a
script, or this document.

## 2. Trigger matrix: when fan-out is mandatory

| Hub change | What must be pushed | Repositories that must be rebuilt | Why |
| --- | --- | --- | --- |
| Any `available` flip in `locales.json`, or an address / label change | `locales.json` in every non-default language repository (plus content roots) | **All** (hub + every language repository, `pages.yml`) | Every site derives `i18n.locales`, the language dropdown, hreflang and the first-visit redirect from its own registry |
| A structural change to `sidebars-hardware.ts` / `sidebars.ts` / `versions.json` / `versioned_sidebars/` | The corresponding file in every language repository | **All** | Each site builds its own navigation; missing one causes a 12/13-category drift |
| A content-root change such as `docs/` | The corresponding root in the target language repository | The pushed language repositories (the hub itself is already triggered by its own push) | Only that site's content is affected |
| Registry / structure and content changes together | Everything | **All** | Take the union; building once more is preferable |

**Do not substitute "wait for the language repository push to trigger itself" for
the dispatch**: when `publish.mjs` commits with `CROSS_REPO_TOKEN`, GitHub's
`GITHUB_TOKEN` recursion rule means that push does not trigger other workflows
(the same rule already applies to `sync.yml`). You must explicitly dispatch
`pages.yml` for every affected repository after the push completes.

## 3. CI-layer specification: repository_dispatch

### 3.1 Who sends it and to whom

- Sender: the hub's `pages.yml` → `publish-content` job (or `sync.yml` after the hub
  build); the credential is the hub repository's Actions secret
  `CROSS_REPO_TOKEN` (fine-grained PAT with `Contents: read and write` on the
  target repositories and write access to `Actions` so a workflow can be
  dispatched; the token value is never printed).
- Target: `pages.yml` in every repository that needs a rebuild.
- Timing: **after** clone → overwrite content roots + `locales.json` → commit →
  push has completed; repositories whose push failed are not dispatched and are
  listed as failures in the job summary.
- The target repository's `pages.yml` must declare `on.repository_dispatch`
  (workflow changes are delivered by the change that owns the workflows).
  `client_payload` carries data only, never credentials.

### 3.2 Event name and payload

The event name is fixed as `content-fanout` (identical in every repository, to make
filtering and troubleshooting easy). Suggested payload:

```json
{
  "repo": "newwlfz/mikrotik_manual_i18n",
  "slug": "en",
  "reason": "locale registry available flip: zh-Hant=true",
  "hub_sha": "<hub HEAD sha>",
  "trigger": "content:publish",
  "changed": ["locales.json", "sidebars-hardware.ts"],
  "locales": ["en", "zh-Hans", "zh-Hant"],
  "fanout_sha": "<hub commit sha that was pushed>"
}
```

- `repo`: `owner/name`, byte-identical to the `repo` field in the hub's `locales.json`;
- `slug`: that repository's locale key in the registry (`en` / `zh-Hans` / `zh-Hant`);
- `reason`: a human-readable reason — for a registry flip, state which locale's
  `available` changed and to what; for a structural change, name the file;
- `hub_sha` / `fanout_sha`: traceable to a specific commit so the rebuild can be
  compared against it;
- `changed`: the sync items that actually changed in this fan-out (from
  `publish.mjs`'s `changedEntries`); only items in `EXPECTED_SYNC_LIST` are listed;
- `locales`: every locale covered by this rebuild (all of them for a registry or
  structural change, otherwise only the pushed ones).

### 3.3 Reference implementation (github-script, illustrative; not written into a workflow in this layer)

```js
const targets = ['newwlfz/mikrotik_manual_i18n',
                 'newwlfz/mikrotik_manual_zh_hans',
                 'newwlfz/mikrotik_manual_zh_hant'];
const payload = {
  repo: '', slug: '', reason: 'locale registry / structure fan-out',
  hub_sha: process.env.GITHUB_SHA,
  changed: ['locales.json'], locales: targets.map(r => r.split('/')[1])
};
for (const repo of targets) {
  const [owner, name] = repo.split('/');
  const slug = name.replace(/^mikrotik_manual_/, '') || 'en';
  await github.rest.repos.createDispatchEvent({
    owner, repo: name, event_type: 'content-fanout',
    client_payload: {...payload, repo, slug}
  });
  core.summary.addRaw(`- ${repo}: repository_dispatch content-fanout\n`);
}
```

The equivalent REST call:

```bash
curl -X POST \
  -H "Authorization: Bearer $CROSS_REPO_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/newwlfz/mikrotik_manual_zh_hans/dispatches \
  -d '{"event_type":"content-fanout","client_payload":{"repo":"newwlfz/mikrotik_manual_zh_hans","slug":"zh-Hans","reason":"locale registry available flip: zh-Hant=true","hub_sha":"<sha>","changed":["locales.json"],"locales":["en","zh-Hans","zh-Hant"]}}'
```

> Gating: when `changed` contains only content roots and neither `locales.json`
> nor `sidebars-hardware.ts`, dispatch only the language repositories that were
> actually pushed. A registry or structural change must dispatch **all**
> repositories, including the hub itself (the hub's `build/index.html` also
> carries the `available-locales` meta).

## 4. Local layer: `content:publish -- --only=<locale>`

```bash
npm run content:publish -- --only=zh-Hans            # no local token -> local copy simulation
npm run content:publish -- --only=zh-Hans --local    # explicitly force the simulation (no push even with a token)
npm run content:publish -- --dry-run                 # read-only plan + current "rebuild" list
```

Simulation semantics (no clone / commit / push / network):

1. copy the 11 `EXPECTED_SYNC_LIST` items from the hub into a temporary directory
   (simulating the payload a target repository receives), printing the item,
   file and byte counts;
2. read the current state of all three repositories with the same `collectFanout()`
   used by `fanout-check`, finding `locales.json` / `sidebars-hardware.ts` drift
   and stale build meta;
3. print the `需重建 (N)` list: for registry / structural drift, list **all three
   repositories** with reasons; for a content-only change, list only the target
   named by `--only`;
4. delete the temporary directory and exit 0 (a simulation is not a failure).

A real run (with a token) prints the same `需重建` list after each repository's
commit/push; `changedEntries` comes from comparing the sha256 of every sync item
before and after the copy, so the dispatch `client_payload.changed` and this list
are the same fact.

## 5. Assertion layer: `fanout-check.mjs`

```bash
node tools/content/fanout-check.mjs             # default --check, human-readable report
node tools/content/fanout-check.mjs --check     # same (explicit)
node tools/content/fanout-check.mjs --json      # machine-readable; exit-code semantics unchanged
```

Assertions (any failure exits 1):

1. the sha256 of `locales.json` is equal in all three repositories;
2. the sha256 of `sidebars-hardware.ts` is equal in all three repositories;
3. in each repository, the `docusaurus-available-locales` meta in
   `build/index.html` equals, in order, `availableLocales` derived from that
   repository's `locales.json` (missing or not rebuilt fails);
4. all 11 `EXPECTED_SYNC_LIST` items exist in every repository;
5. `locales.json` is valid and at least one locale has `available !== false`.

Failure output includes the locale, repository, sha256 (first 16 digits), the
expected/actual available lists for each difference, and per-repository rebuild
reasons. It reads only local files, never reads `.env.local`, and never uses the
network.

**Wiring**: this check has been added to the step list of the hub's
`tools/pipeline/verify.mjs` (after `hardware-fidelity`). `npm run verify` therefore
uses cross-repository consistency as a release gate; a build artifact that has not
been rebuilt yet fails this step — fail-closed by design. The fix is to dispatch a
rebuild as described in section 3, not to change the assertion or its thresholds.
The locale repositories' and the template's `tools/pipeline/verify.mjs` do not
carry this assertion (they have no three-repository view); the hub's verify is
already in the `check:tools-template` whitelist, so the template check still
returns 0.

## 6. Layer boundaries

- This layer (layer 1): the shared contract, publisher simulation and rebuild
  hints, `fanout-check`, verify wiring, the CI dispatch **specification**, and
  live-data repairs.
- Next layer (the workflow subagent): land section 3 in each repository's
  `pages.yml` (`on.repository_dispatch` + dispatch step), and re-run
  `fanout-check` after the rebuild so the build meta catches up with the registry.
