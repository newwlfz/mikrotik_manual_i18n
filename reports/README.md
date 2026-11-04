# Reports

Committed evidence produced by verification runs.

- `visual/` — Playwright screenshots, `report.html`, `report.json`.
- `sync/` — deletion/repair drills and per-run summaries.
- `build/` — broken-link and missing-asset audits.

Raw browser profiles and traces stay in the system temp directory or
`work/`; only the final evidence is committed.
