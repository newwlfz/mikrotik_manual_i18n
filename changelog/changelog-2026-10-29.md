---
title: "Documentation updates - October 29, 2026"
date: 2026-10-29T00:00:00.000Z
slug: /changelog-2026-10-29
source: https://manual.mikrotik.com/changelog/changelog-2026-10-29
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - October 29, 2026

October 29, 2026

Summary of documentation changes made on October 29, 2026.

## Bridging & Switching

-   **[Other Switch Chip Features](/docs/bridging-and-switching/switch-chip-features#port-isolation)**: Port isolation `forwarding-override` can refer to interface lists. Their ports are added to the explicitly listed ports, the resulting set is shown in the read-only `current-forwarding-override`, and an interface list cannot exclude a port. The [`/interface/ethernet/switch/port-isolation`](/docs/cli-reference/interface/ethernet/switch/port-isolation/) reference describes all its arguments.

## High Availability Solutions

-   **[Multi-chassis Link Aggregation Group](/docs/high-availability-solutions/multi-chassis-link-aggregation-group)**: L3 hardware offloading must be disabled on the whole switch (`/interface/ethernet/switch/set 0 l3-hw-offloading=no`); disabling it on individual switch ports is not enough.
