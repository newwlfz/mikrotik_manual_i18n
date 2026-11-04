# Tools

The production automation lives here so the GitHub repository is a complete
site + workflow project, not just build output.

Planned CLI surface:

```bash
npm run sync -- --check          # detect remote changes, no writes
npm run sync -- --update         # fetch normalise and write content
npm run sync -- --repair         # restore missing or changed local files
npm run sync -- --only=docs,hardware,blog,changelog
# Phase 2 only:
# npm run translate -- --changed
# npm run translate -- --locale=zh-Hans --force
npm run verify                   # link, asset and inventory checks
```

Directories:

- `sync/` — inventory, HTTP fetch, Playwright render, transform, state.
- `translate/` — phase 2 only; config-driven Markdown translation. Not
  implemented or invoked in phase 1.
- `verify/` — link/asset/state checks used by CI.

Implementation rules:

- No generated file is written without a state entry.
- Missing local files are always repairable.
- A failed locale translation never blocks the English build.
- Translation preserves frontmatter keys, code fences, URLs and MDX names.
- All CLI commands support `--dry-run`.
