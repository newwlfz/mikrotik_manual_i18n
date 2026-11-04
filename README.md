# MikroTik Manual Mirror — site repository

This repository is the **Docusaurus site only**. It is the directory pushed to
GitHub.

Synchronisation code, raw state, reports, the conversation archive, official
asset snapshots and scratch space live one level above this repository, in the
workspace root. They are deliberately not committed here.

## Scope

- RouterOS documentation, version **7.24** only.
- Hardware Guides.
- Product news (`/blog/`).
- Docs Changes (`/changelog/`).
- CLI comparison at the literal official URL
  `/docs/cli-reference/compare-versions/`.
- English only in phase 1. No language switcher, no GitHub Actions.

## Commands

```bash
npm ci
npm run build
npm run serve
```

## Route map

| Section | Route |
| --- | --- |
| RouterOS 7.24 | `/docs/7.24/...` |
| Hardware | `/hardware/...` |
| Product news | `/blog/...` |
| Docs Changes | `/changelog/...` |
| CLI compare | `/docs/cli-reference/compare-versions/` |

The CLI compare route is a phase-1 pages shim because the official page lives
inside the current 7.26 docs, while this mirror publishes only 7.24. The data
model is shared and the shim can be replaced when multiple versions exist.

## Layout

```text
repo/
├─ docusaurus.config.ts
├─ sidebars.ts
├─ sidebars-hardware.ts
├─ versions.json
├─ versioned_docs/version-7.24/
├─ versioned_sidebars/
├─ hardware/
├─ blog/
├─ changelog/
├─ i18n/<locale>/            # phase 2
├─ src/{pages,components,theme,css}
├─ static/{img,hardware,blog}
├─ package.json
└─ package-lock.json
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for plugin routing, multilingual layout,
asset policy and the incremental workflow.
