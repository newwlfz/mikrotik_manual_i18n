---
title: "Documentation updates - November 9, 2026"
date: 2026-11-09T00:00:00.000Z
slug: /changelog-2026-11-09
source: https://manual.mikrotik.com/changelog/changelog-2026-11-09
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 9, 2026

November 9, 2026

Summary of documentation changes made on November 9, 2026.

## Wireless

-   **[Configuring MeshPoint](/docs/wireless/wifi/configuring-meshpoint)**: New guide for IEEE 802.11s MeshPoint mode: set the Mesh ID and WPA3-PSK security, bridge the mesh and AP interfaces, and verify the peer links. It works on `wifi-qcom-be` and `wifi-mediatek` only, and is configured in the CLI. The [Wi-Fi](/docs/wireless/wifi/) page links the guide and describes the `meshpoint` mode.

## Network Management

-   **[Back To Home](/docs/network-management/cloud/back-to-home)**: Documented the **Disable VPN when home** option: the app saves the router's RouterOS identifier when the tunnel is created with **Create new**, and pauses the tunnel when MikroTik discovery finds that router on the local Wi-Fi. The option does not work for tunnels imported from a QR code or share link, and the check does not run on mobile data.

## Hardware

-   **[TG-LR setup guide](/hardware/tg-lr-setup-guide)**: The generated setup guide moved from the IoT documentation to the hardware section, next to the TG-LR product pages.
