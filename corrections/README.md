# Corrections

`corrections/` is the human-editable layer between the official source and the
generated `docs/`. It is data, not a second copy of the pages.

## Layout

```text
corrections/
  global.yml
  pages/<section>/<version>/<path>.yml
  local-pages/<section>/<version>/<path>.md
```

- `global.yml` controls link policy, table restoration and note style.
- `pages/` contains page-specific exceptions. Every file must name the upstream
  page hash it was written against.
- `local-pages/` contains content the mirror owns and the official site does not
  publish, for example `cli-reference/compare-versions` and the two known 7.24
  `msrp` directory duplicates.

## Page correction format

```yaml
schema: 1
source_sha256: "<sha256 of the upstream page>"
translation_impact: false

operations:
  - id: restore-forwarding-list
    type: replace
    find: |
      exact upstream text
    replace: |
      replacement text
    note:
      en: "Official Markdown flattened this cell; restored from the rendered page."
      zh-Hans: "官方 Markdown 压平了该单元格；本页按渲染后的页面还原。"
```

Rules:

- `source_sha256` is required. A mismatch fails closed: the upstream page changed
  and the correction must be reviewed.
- `translation_impact: true` means the English block changed and its translation
  memory entry is stale. `false` means structure or link spelling only.
- `note` is structured data (`en`, `zh-Hans`), not raw HTML. P1 renders the
  English note through the `CorrectionNote` component; P3 can localise it.
- If a correction is needed on more than a few pages, it is a missing pipeline
  rule, not a page correction.

## Baseline checks

```bash
npm run upstream:verify
npm run structure:check
npm run materialize:check
```

`docs/` and `i18n/` are generated. Do not hand-edit them.
