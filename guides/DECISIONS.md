# Decisions

Accepted decisions for the multi-site mirror, with the reasoning and the
consequences each one is bought with. "Accepted" means the implementation in
this repository follows it; changing one is a deliberate architecture change,
not a tweak.

Scope: the English hub (`newwlfz/mikrotik_manual_i18n`), the language sites
(currently `newwlfz/mikrotik_manual_zh_hans`), and the content/translation
pipeline that feeds them. See
[`ARCHITECTURE-MULTISITE.md`](ARCHITECTURE-MULTISITE.md) for the mechanics and
[`CI.md`](CI.md) for the workflows.

## D1. Keep every documentation version

**Decision.** The mirror keeps all archived RouterOS documentation versions
(currently 7.24, 7.25 and the current release) in each site. Size pressure is
solved by removing duplication and sharing assets, never by deleting a version.

**Context.** The official site serves versioned documentation; a mirror that
silently drops versions is not a mirror. The Pages artifact is large
(~1.1 GiB with shared assets), but under the 10 GiB artifact limit.

**Consequences.**

- If a deployment ever hits a hard published-site limit, the fallback order is:
  share assets (done) → split locales into separate sites (done) → only then
  reconsider versions, as a product decision recorded here.
- Version routing is data (`data/manifests/current-version.json`,
  `versions.json`), so adding a version is a pipeline run, not a code change.
- Each language repository serves the same version set; translations are
  overlaid per version.

## D2. One repository per language

**Decision.** Every locale has its own repository with its own build and
deployment (`locales.json` → `repo`). The English hub is the default locale's
repository.

**Context.** A single-repository bilingual build duplicated static assets into
`build/<locale>/`, produced a single deploy artifact for all languages, and
mixed English source with translation overlays that belong to different
maintainers and cadences. It also made one broken locale block the other's
deployment.

**Consequences.**

- `build/<locale>/` no longer exists; each build produces one locale at its
  site root.
- Language switching is cross-site: `localeConfigs.url`/`baseUrl` are absolute
  addresses, generated from the registry. The dropdown and `hreflang` never
  assume a sibling directory.
- A language site failure cannot take the hub (or another language) down; a
  hub build failure cannot block a content publish.
- The shared `docusaurus.config.ts` and `tools/` are duplicated per repository
  on purpose: no build-time dependency on another checkout. They are updated
  together, deliberately — the publish job ships content only.

## D3. Share assets from the hub

**Decision.** The English hub is the asset host. `static/` (images, PDFs,
videos, captured pages, CLI data) lives only there; language sites set
`ASSET_ORIGIN` and publish no static tree.

**Context.** Duplicating ~99 MiB of `/img` plus PDFs into every language
artifact was the main driver of artifact size and deploy time, and the copies
were byte-identical.

**Consequences.**

- The hub's build must set `ASSET_HOST=true`, otherwise `slim` prunes `/img`
  that only translated pages request.
- Moving, renaming or re-pathing the hub breaks assets on every language site
  at once: `ASSET_ORIGIN` must be updated in all language repositories in the
  same change. A future CDN only changes `ASSET_ORIGIN`.
- A language site's `verify:deploy` counts external references instead of
  checking them locally; it cannot prove the hub serves them.

## D4. Translation memory is repository state

**Decision.** The translation memory (TM) and the comment memory are versioned
artifacts, committed in the language repository that owns the translations.

**Context.** Rebuilding from scratch on every run is slow, non-deterministic and
loses reviewed decisions. A cache that disappears with the runner makes
translation quality depend on CI luck.

**Consequences.**

- A run can resume from the committed memory and only translate new or changed
  segments; reviewers can audit what was reused.
- The TM must be updated and committed with the translation output in the same
  change, or the next run loses the reuse.
- Current state: the language repository still ignores `work/translate/` and
  describes the memory as prototype scaffolding. Moving it to a tracked path
  (and committing it with overlay updates) is the required implementation of
  this decision; until then the decision is only partially met.

## D5. Runs are resumable

**Decision.** Long pipeline runs record their progress and resume from the
first incomplete stage; they do not restart from zero after a failure.

**Context.** Sync, translation and build take tens of minutes; a transient
network or LLM failure in a late stage used to throw away the whole run.

**Consequences.**

- `state/update-run.json` is the journal: stage names, inputs and the last
  failed stage. A rerun continues after the last completed stage.
- Every stage stays idempotent and independently runnable, so resuming and
  re-running a single stage are the same operation.
- A journal that no longer matches the checkout (different version target,
  edited inputs) is invalidated rather than trusted.

## D6. Partial output is never published

**Decision.** A run that produced incomplete or unverified output does not
deploy. Deployment is gated on the full verification suite, not on "the build
exited 0".

**Context.** Docusaurus happily builds a site with missing pages, broken
assets or half-written overlays. Publishing that silently replaces a good site
with a worse one.

**Consequences.**

- `pages.yml` runs `verify:deploy` (slim → asset-refs → base-url-refs →
  orphan-assets → llms-links) before uploading the Pages artifact. A failure
  stops the deploy and the previous deployment stays live.
- Translation pipelines preserve the previous overlay for any page that fails
  to rebuild, and report it; they never write an empty page.
- A failed content publish leaves the language repository on its last commit,
  and a failed language build leaves its last successful Pages deployment
  live. "Nothing changed" is the safe outcome.

## D7. Adding a locale is a local, reviewed change

**Decision.** Adding a locale (repository, registry entry, overlays,
deployment) is done on a developer machine and reviewed like code. It is not
an automated CI side effect. A `locale:add` helper, when used, runs locally and
its output is committed.

**Context.** A CI job that creates repositories, writes `locales.json`, adds
secrets or scaffolds overlays has production side effects that are hard to
review, hard to undo and impossible to test in a fork.

**Consequences.**

- The supported path is: create the repository → add one `locales.json` entry →
  `npm run locales:check` → `npm run content:publish:dry` →
  `npm run content:publish -- --only=<tag>` (or let the next push to `main`
  publish).
- `npm run locales:check` is the only automated gate; it validates, it does not
  mutate.
- CI may publish **existing** locales (content sync) but never invent a locale
  or a deployment address. A stale `locales.json` fails loudly instead.

## D8. The registry is the single source of truth

**Decision.** `locales.json` is the only locale list and the only place a
locale's repository, `baseUrl` and absolute site address are declared.
`docusaurus.config.ts`, `tools/lib/site-config.mjs` and the publisher derive
everything from it.

**Context.** The locale list used to live in `docusaurus.config.ts` while
deployment variables lived in each workflow; they drifted, and scripts parsed
the config with regular expressions.

**Consequences.**

- Adding or moving a locale is a one-file change plus the site's own
  deployment variables.
- `default` must be `en`; a fork with another hub language changes this
  assertion deliberately.
- Environment variables still override addresses for previews and forks; they
  are overrides, not a second source of truth.
