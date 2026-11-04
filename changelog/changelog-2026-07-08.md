---
title: "Documentation updates - July 8, 2026"
date: 2026-07-08
slug: /changelog-2026-07-08
source: https://manual.mikrotik.com/changelog/changelog-2026-07-08
captured_at: '2026-11-04T06:08:09+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 8, 2026.

## Management Tools

- **[Console](/docs/7.24/management-tools/console)**: Merged the separate "Command Line Interface" page into the Console page so all CLI/console material lives in one place, updating cross-references from the Scripting, Bluetooth, and MQTT pages accordingly, and fixed a small formatting issue in the Quick Typing section.

## Developer Guides

- **[Scripting](/docs/7.24/developer-guides/scripting)**: Documented the order-by parameter for the print command, which sorts output by up to three properties (prefix a property with - for descending order), with examples.

## High Availability Solutions

- **[VRRP](/docs/7.24/high-availability-solutions/vrrp)**: Added the v3-checksum-as-v2 setting, which controls whether the VRRPv3 IPv4 checksum includes the IPv4 pseudoheader. The default (no) matches Linux-based implementations such as FRR; set it to yes for compatibility with Cisco and other vendors. It applies only to VRRPv3 IPv4, and all routers in a Virtual Router must use the same value to avoid "bad checksum" errors.
