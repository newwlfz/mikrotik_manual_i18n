---
title: "Documentation updates - June 1, 2026"
date: 2026-06-01
slug: /changelog-2026-06-01
source: https://manual.mikrotik.com/changelog/changelog-2026-06-01
captured_at: '2026-11-04T06:07:49+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 1, 2026.

## Network Management

- **[Reverse Proxy](/docs/7.24/network-management/proxy/reverse-proxy)**: Added the vrf parameter for selecting the Virtual Routing and Forwarding instance used by a reverse-proxy record. Updated the ip-address property to note that both IPv4 and IPv6 server addresses are now supported (previously IPv4 only).
- Renamed the **IP Services** sidebar category to **Network Services**.

## Bridging & Switching

- **[L3 Hardware Offloading](/docs/7.24/bridging-and-switching/l3-hardware-offloading)**: Removed a duplicate **98DX8525** row from the Marvell switch-chip capabilities table.

## CLI Reference

- **[CLI Reference](/docs/7.24/cli-reference)**: Added an argument-type reference to the start page. It documents every parameter type the reference uses, including address, enum, num, time, iface_enum, and ipPrefix, so you can interpret the type shown for each command property.
- **[CLI Reference](/docs/7.24/cli-reference)**: Fixed broken cross-reference links across the section after its folder restructuring, including the bridge links on the BGP page.
