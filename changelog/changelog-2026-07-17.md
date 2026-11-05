---
title: "Documentation updates - July 17, 2026"
date: 2026-07-17
slug: /changelog-2026-07-17
source: https://manual.mikrotik.com/changelog/changelog-2026-07-17
captured_at: '2026-11-04T06:08:14+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 17, 2026.

## User Guides

- **[PIM-SM](/docs/user-guides/routing-and-networking-protocols/multicast/pim-sm)**: Reworked the configuration examples. The basic example now splits the PIM interface template from a separate igmp-interface-template for the client-facing interface, so the PIM instance learns local group memberships. The static RP example replaces the loopback bridge with the built-in lo interface and adds IGMP querier configuration for R2 and R3.
- **[IGMP proxy](/docs/user-guides/routing-and-networking-protocols/multicast/igmp-proxy)**: Removed the quick-leave configuration example.

## Hardware Guides

- **[hAP ax 2](/hardware/hap-ax-2) and [hAP ax 3](/hardware/hap-ax-3)**: Renamed the hAP ax pages so page names match the products — the former hap-ax page is now hap-ax-3, and hap-ax-2 now holds the hAP ax 2 content. Existing bookmarks to the old hap-ax URL will need updating.
- **[Wireless systems](/hardware/ldf-5-series)**: Added product images from mikrotik.com to the LDF 5, SXT SA, and SXT SQ series pages, and to several LTE kit pages.
- **[Hardware guides](/hardware)**: WinBox download links across 176 device pages now use the mt.lv/winbox shortcut, and the default IP address 192.168.88.1 is now linked with an explicit https:// scheme.
