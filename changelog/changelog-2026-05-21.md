---
title: "Documentation updates - May 21, 2026"
date: 2026-05-21
slug: /changelog-2026-05-21
source: https://manual.mikrotik.com/changelog/changelog-2026-05-21
captured_at: '2026-11-04T06:07:44+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on May 21, 2026.

## Bridging & Switching

- **[Bridging & Switching](/docs/bridging-and-switching)**: Restored the illustrations across the whole Bridge topic — diagrams on the switch chip features, VLAN, QoS, CRS1xx/2xx examples, layer 2 misconfiguration, spanning tree, and wireless VLAN trunk pages now render again.
- **[Switch chip features](/docs/bridging-and-switching/switch-chip-features)**: Fixed the feature comparison table footnotes, which previously did not render. The notes on bandwidth limiting in RouterOS v7, Shared VLAN Learning on the 2048-entry host table, and limited Switch menu VLAN support now appear below the table. Several inline "Caution"/"Important" paragraphs were converted into proper admonition blocks.
- **[Quality of Service](/docs/bridging-and-switching/quality-of-service)**: Fixed the broken footnote markers in the switch chip QoS table covering max-fill statistics, current-value reporting, and unavailable statistics on 98CX8410.
- **[Marvell Prestera switch chip features](/docs/bridging-and-switching/marvell-prestera-switch-chip-features)**: Corrected several malformed admonition blocks so the L3 hardware offloading note, the egress-rate/storm-rate hardware limitation on 10Gbps ports, and the switch ACL modification warning display correctly. Also reworded the inter-VLAN routing and DHCP server notes.

## Containers

- **[Containers](/docs/containers)**: Expanded the stop-signal description to explain that different Linux signals allow graceful shutdown, immediate termination, or application-specific actions, and tidied the memory-max entry.
