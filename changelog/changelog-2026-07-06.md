---
title: "Documentation updates - July 6, 2026"
date: 2026-07-06
slug: /changelog-2026-07-06
source: https://manual.mikrotik.com/changelog/changelog-2026-07-06
captured_at: '2026-11-04T06:08:09+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 6, 2026.

## Bridging & Switching

- **[Bridge](/docs/bridging-and-switching/)**: Documented the valid-value stepping rules for STP/MSTP priority fields. Bridge and MSTI priorities must be set in steps of 4096 (0x1000) — the 12 lowest bits are ignored — with the full list of valid hex/decimal values; bridge port and MST-override port priorities must be set in steps of 16 (0x10) and now use an explicit 0x00–0xf0 value set. Also fixed the port-cost-mode path-cost reference table, which was broken during migration, rendering it as a proper collapsible table with both Long and Short columns.
- **[Spanning Tree Protocol](/docs/bridging-and-switching/user-guides/spanning-tree-protocol)**: Applied the same priority stepping and valid-value details to the CIST/MSTI/port priority descriptions.

## System

- **[Neighbor discovery](/docs/system-information-and-utilities/neighbor-discovery)**: Added an "LLDP neighbors" section documenting the read-only /ip/neighbor/lldp menu, which shows detailed LLDP TLVs (chassis ID, port ID, system name/description) for LLDP-discovered neighbors only, with example output and a note that the lldpRemTable SNMP table excludes CDP/MNDP-only entries.
