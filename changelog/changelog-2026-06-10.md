---
title: "Documentation updates - June 10, 2026"
date: 2026-06-10
slug: /changelog-2026-06-10
source: https://manual.mikrotik.com/changelog/changelog-2026-06-10
captured_at: '2026-11-04T06:07:57+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 10, 2026.

## Hardware

- **[Hardware Guides](/docs/7.24/hardware)**: Backfilled official MikroTik product short descriptions on 73 hardware pages, pulled from the public products API and matched by product code. Added links from descriptions to the corresponding mikrotik.com product pages.
- **[Hardware Guides](/docs/7.24/hardware)**: Added covers-box and photo-row layouts for multi-variant product pages, with product-code links for each variant. Standardized "This article covers" intro admonitions on 18 multi-product pages.
- **[Hardware Guides](/docs/7.24/hardware)**: Added side-by-side clickable thumbnail galleries for step-photo sequences — consecutive images inside a section now render as small thumbnails with lightbox zoom.
- **[Hardware Guides](/docs/7.24/hardware)**: Extensive layout cleanup: fixed hero images, normalized section heading levels, demoted stray sentence-as-heading intros, removed Confluence leftover markup (bare asterisks, macro junk, broken TOCs), and re-fenced unfenced code blocks. Removed obsolete KNOT subpages that were moved to the IoT section.
- Re-imported the TG-LR hardware page from Confluence with fixed exporter issues.
- **[Hardware Guides](/docs/7.24/hardware)**: Replaced lead images on roughly 80 more pages with official MikroTik product photos (WebP) from the products API, including unified LtAP and LtAP mini imagery across all guide pages.
- **[Hardware Guides](/docs/7.24/hardware)**: Added missing mikrotik.com product-page links to 70 more pages and moved the wAP ax LTE7 kit page into the LTE Products category.
- **[Hardware Guides](/docs/7.24/hardware)**: Second Confluence cleanup pass: removed external-link icon artifacts from 120 pages, fixed orphan heading text that broke bullet lists on 83 pages, removed non-breaking-space and WinBox URL artifacts, repaired concatenated URLs, broken product codes, and trailing + in language-specific help URLs in compliance tables, and fixed the hAP ax lite LTE6 and hAP lite TC page structure.
- **[Hardware Guides](/docs/7.24/hardware)**: Replaced all 46 dead wiki.mikrotik.com links with internal manual pages (SFP/wired interface compatibility, LEDs, GPS, W60G, LTE/5G, LoRa, Serial Console, S+RJ10 guidance) or the current SwOS manuals on help.mikrotik.com. A site-wide link check also fixed moved or dead external links in other sections (ZeroTier, kernel NAPI, RFC 8092, Vultr, ThingsBoard, wi-fi.org) and unlinked placeholder hostnames that were never web pages.

## Internet of Things

- **[Modbus](/docs/7.24/internet-of-things/modbus)**: Removed the page slug (was incorrectly pointing to a hardware-specific path). Added a KNOT compatibility warning listing supported models with RS-485 ports. Fixed property table formatting and reorganized the downgrade/cancel sections.
- **[Bluetooth](/docs/7.24/internet-of-things/bluetooth)**: Fixed broken links and image references in the BLE tag email notification guide, added links to the MikroTik tag advertisement formats page and iOS/Android beacon manager guides, and replaced legacy &lt;note&gt; HTML with proper Docusaurus :::info admonitions.
- **[Bluetooth](/docs/7.24/internet-of-things/bluetooth)**: Completed and fixed the beacon manager guides (index, Android, iOS). Removed custom /slug frontmatter overrides from IoT Bluetooth pages so URL structure matches the filesystem layout.
- **[GPIO](/docs/7.24/internet-of-things/gpio)**: Fixed a broken image reference in the pulse-input guide.
- **[Lora](/docs/7.24/internet-of-things/lora)**: Renamed the "Setup" section to "User Guides" and moved the TG-LR device documentation into it as the [TG-LR setup guide](/docs/7.24/internet-of-things/lora/user-guides/tg-lr-setup-guide), with restored warning admonitions and docs-style metadata.
- **[Bluetooth](/docs/7.24/internet-of-things/bluetooth)**: Completed and fixed the BLE tag notification and telemetry guides (MQTT and Azure, HTTPS POST and Azure, MQTT/HTTPS and AWS, IFTTT app notifications, ThingsBoard temperature readings): restored dead "follow this link" references with working Microsoft Learn and vendor links, updated screenshots, and filled in missing configuration steps.

## CLI Reference

- **[IP Settings](/docs/7.24/cli-reference/ip/settings)**: Added descriptions for the ipv4-high-fragment-thresh parameter (upper memory bound for fragment reassembly queues, with per-RAM defaults) and the ipv4-fragment-time parameter (fragment lifetime in seconds).

## Getting Started

- **[Packages](/docs/7.24/getting-started/installation-and-upgrade/packages)**: Corrected the wifi-qcom-be architecture support list from arm, arm64 to arm64 only, matching the actual WiFi-7 802.11be driver requirements.
