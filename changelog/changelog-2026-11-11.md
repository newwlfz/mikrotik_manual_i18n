---
title: "Documentation updates - November 11, 2026"
date: 2026-11-11T00:00:00.000Z
slug: /changelog-2026-11-11
source: https://manual.mikrotik.com/changelog/changelog-2026-11-11
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 11, 2026

November 11, 2026

Summary of documentation changes made on November 11, 2026.

## CLI Reference

-   **[Routing/BGP connection](/docs/cli-reference/routing/bgp/connection)**: `remote.ttl` defaults to `local.ttl` when it is not set, so with the default `local.ttl=255` only single-hop peers can establish the session. For multihop peers, set `remote.ttl` below the TTL at which the peer's packets arrive, or leave `local.ttl` unset to disable the minimum. The property affects EBGP peers.

## Wireless

-   **[Configuring MeshPoint](/docs/wireless/wifi/configuring-meshpoint)**: Documented channel selection. The initial scan picks the channel of the peer with the lowest MAC address when the mesh is visible on several channels, and the radio scans again every 2–3 hours. `channel.reselect-interval` or `channel.reselect-time` controls the background scan, and a reselection can briefly disrupt the mesh.

## Hardware

-   **[TG-LR82](/hardware/tg-lr82), [TG-LR92](/hardware/tg-lr92)**: Aligned the hardware specifications with the product data, and improved the links between the product pages and the setup guide.
