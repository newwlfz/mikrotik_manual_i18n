---
title: "Documentation updates - June 9, 2026"
date: 2026-06-09
slug: /changelog-2026-06-09
source: https://manual.mikrotik.com/changelog/changelog-2026-06-09
captured_at: '2026-11-04T06:07:53+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 9, 2026.

## Hardware

- **[Hardware Guides](/docs/7.24/hardware)**: Added a new Hardware Guides section imported from Confluence, covering 60 GHz products, accessories, indoor wireless, IoT products, LTE products, RouterBoard, switches, and wireless systems, with normalized page structure and certification badges across all pages.

## Internet of Things

- **[Bluetooth](/docs/7.24/internet-of-things/bluetooth)**: Moved the KNOT and Bluetooth guides (notification guides, beacon manager apps, GPIO pulse input) from the hardware section into IoT, and removed the resulting duplicate pages.

## Mobile Networking

- **[BG77 Modem AT Commands](/docs/7.24/mobile-networking/bg77-modem-at-commands)**: Moved the BG77 modem AT command guide from Hardware to the Mobile Networking section.

## CLI Reference

- **[Netwatch](/docs/7.24/cli-reference/tool/netwatch)**: Added descriptions for all netwatch probe parameters.
- Split the monolithic MPLS and queue CLI reference pages into separate pages per submenu, and moved connection tracking parameters to a [dedicated page](/docs/7.24/cli-reference/ip/firewall/connection/tracking).

## Containers

- **[Containers](/docs/7.24/containers)**: Added a warning that containers require DNS to be configured, otherwise the container will not start.

## Diagnostics & Monitoring

- **[Packet Sniffer](/docs/7.24/diagnostics-monitoring-and-troubleshooting/packet-sniffer)**: Corrected the traffic generator PCAPNG information — the format is supported starting from RouterOS 7.21.

## Getting Started

- **[Packages](/docs/7.24/getting-started/installation-and-upgrade/packages)**: Updated the package list — added the wifi-mediatek and wifi-qcom-be driver packages and cleaned up architecture lists and formatting. Also updated architecture reference names and fixed typos on related pages.
