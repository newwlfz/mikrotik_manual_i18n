---
title: "Documentation updates - October 29, 2026"
date: 2026-10-29T00:00:00.000Z
slug: /changelog-2026-10-29
---

# Documentation updates - October 29, 2026

October 29, 2026

Summary of documentation changes made on October 29, 2026.

## Bridging & Switching[​](#bridging--switching "Direct link to Bridging & Switching")

-   **[Other Switch Chip Features](/docs/7.24/bridging-and-switching/switch-chip-features#port-isolation)**: Port isolation `forwarding-override` can refer to interface lists. Their ports are added to the explicitly listed ports, the resulting set is shown in the read-only `current-forwarding-override`, and an interface list cannot exclude a port. The [`/interface/ethernet/switch/port-isolation`](/docs/7.24/cli-reference/interface/ethernet/switch/port-isolation/) reference describes all its arguments.

## High Availability Solutions[​](#high-availability-solutions "Direct link to High Availability Solutions")

-   **[Multi-chassis Link Aggregation Group](/docs/7.24/high-availability-solutions/multi-chassis-link-aggregation-group)**: L3 hardware offloading must be disabled on the whole switch (`/interface/ethernet/switch/set 0 l3-hw-offloading=no`); disabling it on individual switch ports is not enough.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
