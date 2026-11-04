---
title: "Documentation updates - May 20, 2026"
date: 2026-05-20
slug: /changelog-2026-05-20
source: https://manual.mikrotik.com/changelog/changelog-2026-05-20
captured_at: '2026-11-04T06:07:44+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on May 20, 2026.

## Getting Started

- **[RouterOS licensing](/docs/7.24/getting-started/routeros-licensing)**: Restructured the licensing documentation. The x86 licensing content was merged into a single [x86 licensing](/docs/7.24/getting-started/routeros-licensing/x86) page instead of a separate sub-page, and the accompanying screenshots were reorganized.

## Containers

- **[Containers](/docs/7.24/containers)**: Documented passing the serial terminal through to a container with devices=serial0:"", including a note that the RouterOS serial console under /system/console must be freed first.

## Wireless

- **[Nv2](/docs/7.24/wireless/abgn/nv2)**: Reorganized the protocol overview into continuous prose by removing redundant sub-headings, and tidied the synchronization and configuration example sections.
- **[Spectral scan](/docs/7.24/wireless/abgn/spectral-scan)**: Corrected the formatting of the range option list and downgraded the unsupported-chipset callout from a danger to a warning admonition.
