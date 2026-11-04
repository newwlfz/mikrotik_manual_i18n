# Execution plan and acceptance gates

Source anchor: `transcript.md#turn-1`.

## Phase order

1. **Workspace and repository** — create `mikrotik-manual-mirror/`, initialise
   Git on `main`, no remote. Old sibling directories are out of scope.
2. **Route spike** — Docusaurus 3.10.1 with:
   - versioned 7.24 docs;
   - Hardware docs plugin instance;
   - `/blog` and `/changelog` blog instances;
   - placeholder pages for each route.
   Verify `/docs/7.24/introduction`, `/hardware/`, `/blog/`, `/changelog/`.
3. **Inventory** — crawl the official 7.24 sidebar recursively; cross-check
   against the 1,418-path runtime manifest. Build a canonical URL list.
4. **Docs import** — fetch `.md` endpoints, normalise generated duplicate
   headings, add frontmatter, preserve MDX components, download assets.
5. **Hardware import** — Playwright + Turndown + custom rules; localise images.
6. **Blog and Changelog import** — Playwright + Turndown; frontmatter with
   date/tags/slug; separate plugin trees.
7. **CLI model and compare UI** — parse `<ArgTable>`; generate
   `data/cli/7.24/en.json`; implement `<CliCompare />`; self-compare must be 0.
8. **Incremental drill** — delete one docs, one hardware, one blog file; run
   `--repair`; verify all three restored and state updated.
9. **Build and visual verification** — `npm run build`, local serve,
   Playwright screenshots and DOM/computed-style report for local vs official.

## Acceptance gates

- Build passes with broken-link checks set to `throw`.
- No image references the official origin.
- `sync_state.json` covers every inventory item.
- Self-comparison reports 0 added / 0 removed / 0 changed parameters.
- The repair drill restores the exact deleted files.
- Playwright report shows matching navbar order, sidebar hierarchy, article
  landmarks and footer columns.
- Known visual differences are listed explicitly, not hidden.

## Non-goals in phase 1

- Translation or language switcher.
- 7.25/7.26 content.
- GitHub Actions.
- A remote Git push.
- Pixel-perfect claims where fonts or browser rendering differ; structural
  equality plus a screenshot diff is the evidence.
