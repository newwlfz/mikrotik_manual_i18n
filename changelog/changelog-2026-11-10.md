---
title: "Documentation updates - November 10, 2026"
date: 2026-11-10T00:00:00.000Z
slug: /changelog-2026-11-10
source: https://manual.mikrotik.com/changelog/changelog-2026-11-10
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 10, 2026

November 10, 2026

Summary of documentation changes made on November 10, 2026.

## Wireless

-   **[Wi-Fi](/docs/wireless/wifi/)**: Spectral scan is supported only by the `wifi-qcom` driver. It does not work with `wifi-qcom-ac`, `wifi-mediatek` or `wifi-qcom-be`.

## VPN

-   **[GRE](/docs/virtual-private-networks/gre)**: The keepalive description now states when the tunnel loses its running flag. The router sends GRE echo probes every `KeepaliveInterval` seconds, up to `KeepaliveRetries` times, and removes the running flag about interval × retries after the last answered probe — about 100 s with the default `10s,10`. Without keepalive, nothing removes the flag, so a tunnel to an unreachable remote end stays running.
