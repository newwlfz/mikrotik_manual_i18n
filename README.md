# MikroTik Manual Mirror

A source-faithful, version-aware mirror of <https://manual.mikrotik.com/>.

This repository is the complete automation project: the Docusaurus site, the
synchronisation/translation tools, the workflow configuration, and the state
needed to detect changes. It is not a build-output-only repository.

## Scope of phase 1

- RouterOS documentation, version **7.24** only.
- Hardware Guides.
- Product news (`/blog/`).
- Docs Changes (`/changelog/`).
- CLI comparison at the literal official URL
  `/docs/cli-reference/compare-versions/`.
- English only. Translation is configured but disabled and not implemented
  in phase 1.
- GitHub Actions are present: CI, Pages deploy, and a feature-flagged sync
  workflow. The sync workflow stays disabled until its tools are implemented.

## Commands

```bash
npm ci
npm run build
npm run serve
```

Phase 1 automation commands (implemented under `tools/`):

```bash
npm run sync -- --check
npm run sync -- --update
npm run sync -- --repair
npm run verify
```

Translation (`npm run translate`) is phase 2 and is not invoked by the phase-1
workflow.

## Route map

| Section | Route |
| --- | --- |
| RouterOS 7.24 | `/docs/7.24/...` |
| Hardware | `/hardware/...` |
| Product news | `/blog/...` |
| Docs Changes | `/changelog/...` |
| CLI compare | `/docs/cli-reference/compare-versions/` |

The CLI compare route is a pages shim because the official page lives inside
the current 7.26 docs, while this mirror publishes only 7.24. The data model is
shared and the shim can be replaced when multiple versions exist.

## Automation

- `config/mirror.yml` — source, versions, sections, locale switches.
- `config/translation.yml` — provider, model, glossary, preserved structures.
- `state/` — committed source/translation hashes.
- `data/cli/7.24/` — generated CLI model.
- `tools/` — sync, translate and verify code.
- `.github/workflows/` — CI, Pages, scheduled sync.

To enable a language later:

1. set `locales.<locale>.enabled: true` and `translate: true` in
   `config/mirror.yml`;
2. set `translation.enabled: true`;
3. add `DEEPSEEK_API_KEY` as a repository secret;
4. run the sync workflow once. It creates the `i18n/<locale>/` overlay and
   builds the locale routes.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design.
