---
title: "Documentation updates - November 12, 2026"
date: 2026-11-12T00:00:00.000Z
slug: /changelog-2026-11-12
source: https://manual.mikrotik.com/changelog/changelog-2026-11-12
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 12, 2026

November 12, 2026

Summary of documentation changes made on November 12, 2026.

## Firewall & QoS

-   **[Packet flow](/docs/firewall-and-quality-of-service/packet-flow-in-routeros)**: Replaced the packet flow diagram and rewrote the sections that describe it: the overall diagram, the detailed bridging, routing and MPLS part, the facilities in each chain, and the chains that VRF traffic passes.
-   **[RAW](/docs/firewall-and-quality-of-service/firewall/raw)**: Overhauled the page. It now covers dropping unwanted traffic before connection tracking, excluding traffic with `action=notrack` (including a single-service example), grouping rules into chains, the IPv6 table, and how RAW differs from filter. All rule properties and the action list are described in the CLI reference.

## Bridging & Switching

-   **[Switch chip features](/docs/bridging-and-switching/switch-chip-features), [QoS](/docs/bridging-and-switching/quality-of-service), [Marvell Prestera](/docs/bridging-and-switching/marvell-prestera-switch-chip-features)**: Documented Prestera to-CPU QoS: the traffic classes, the TO\_CPU switch-cpu queues and the `traffic-class=7` ACL route that sends matched traffic to the CPU. The switch rule properties are described as well.
