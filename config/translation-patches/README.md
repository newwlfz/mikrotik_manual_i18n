# Page-level translation patches

A patch is a per-locale file that survives regeneration:

```text
config/translation-patches/<locale>/<section>/<path>.yml
```

`section` is one of `docs`, `docs-7.24`, `hardware`, `blog`, `changelog`;
`path` is the page path relative to that section, with `.yml` appended.

```yaml
# config/translation-patches/zh-Hans/docs/network-management/dns.yml
title: "DNS"

# Blocks that must stay in English (matched on the normalised English text).
keep_english:
  - "This paragraph is a legal statement and stays as it is."

# Exact wording corrections applied after generation.
replace:
  - from: "旧的译法"
    to: "新的译法"
```

Rules:

- A patch is for a single page. If three pages need the same change, add a rule
  to `config/translation-rules.yml` and enforce it in the pipeline instead.
- Patches are applied by both `apply` and `translate`, so the result does not
  depend on which command ran last.
- Never edit a file under `i18n/` to fix wording: the next `apply` regenerates it
  and your edit is lost.
