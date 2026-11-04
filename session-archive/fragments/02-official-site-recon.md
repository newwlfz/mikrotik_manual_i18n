# Official-site reconnaissance

Source anchor: `transcript.md#turn-1` (read-only probing, no bulk capture).

## Platform

- Generator meta tag: `Docusaurus v3.10.1`.
- HTML classes prove:
  - default docs plugin: `plugin-docs plugin-id-default`;
  - versioned docs: `docs-version-7.24`;
  - Hardware: `plugin-docs plugin-id-hardware`, `docs-version-current`.
- Navbar order: logo, Docs, Hardware, Compare Versions, Blog, Changelog.
- Version dropdown on docs pages: 7.26 (current), 7.25, 7.24.

## Inventory

| Section | Mechanism | Approx. size | Markdown endpoint |
| --- | --- | ---: | --- |
| RouterOS 7.24 | versioned docs plugin | 1,418 pages (1,054 CLI) | yes |
| Hardware | separate docs plugin | 250 pages | no |
| Product news | blog plugin | 10 posts | no |
| Docs Changes | second blog plugin | 132 posts | no |

The official `sitemap.xml` has 2,339 URLs but does **not** list `/docs/7.24/`.
It is a current-version sitemap, not a 7.24 inventory.

## Endpoint findings

- `https://manual.mikrotik.com/docs/7.24/introduction.md` returns 200 with
  `application/octet-stream`.
- `https://manual.mikrotik.com/docs/7.24/` itself returns 403/empty; use a
  concrete document path.
- `.md` output already contains a generated H1 + summary quote and then the
  real content (often a second H1). Import must normalise that duplication.
- CLI `.md` preserves `<ArgTable>` and `<ArgTableRow>`.
- Hardware `.md`, Blog `.md`, and Changelog `.md` return 404. Use Playwright.
- CLI comparison:
  - `/docs/cli-reference/compare-versions/` exists (7.26 current);
  - `/docs/7.24/cli-reference/compare-versions/` is 404;
  - the page is MDX with `<CliCompare />`;
  - its own text says data is generated from
    `versioned_docs/version-*/cli-reference`.

## Official runtime source map

The official `main.js` chunk map exposes source paths, which were used only as
a completeness audit:

- `versioned_docs/version-7.24/...`: 1,418 unique paths;
- `hardware/...`: 250;
- `blog/...`: 12 paths (10 posts plus index/truncated duplicates);
- `changelog/...`: 216 paths (posts plus pagination/truncated duplicates).

This is not a build input. Content is fetched from the public endpoints.
