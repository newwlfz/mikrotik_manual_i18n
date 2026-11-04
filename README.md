# MikroTik Manual Mirror

A source-faithful, incrementally synchronised mirror of <https://manual.mikrotik.com/>.

**Status: foundation / architecture phase.** No production content has been
scraped yet. The old sibling directories `mikrotik-docs-i18n/` and
`mikrotik_manual_i18n/` are out of scope and must never be read, changed, or
used as input.

## Scope of phase 1

- RouterOS documentation, version **7.24** only.
- Hardware Guides.
- Product news (`/blog/`).
- Docs Changes (`/changelog/`).
- CLI Reference comparison, 7.24 against itself (zero differences).
- English only. No translation and no language switcher in this phase.
- No GitHub Actions and no remote configured.

## Planned commands

```bash
npm ci
npm run sync -- --full       # populate the mirror from the official site
npm run sync -- --check      # report missing/changed local files
npm run sync -- --repair     # restore missing files and update state
npm run build
npm run serve
npm run verify:visual        # Playwright DOM + screenshot comparison
```

These commands are introduced as the implementation lands.

## Repository map

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full layout, plugin
configuration, multilingual plan, asset policy, and incremental-sync design.
See [session-archive/README.md](session-archive/README.md) for the conversation
archive and its retrieval index.
