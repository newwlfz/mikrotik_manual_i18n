---
title: "Documentation updates - July 14, 2026"
date: 2026-07-14
slug: /changelog-2026-07-14
source: https://manual.mikrotik.com/changelog/changelog-2026-07-14
captured_at: '2026-11-04T06:08:13+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 14, 2026.

## Bridging & Switching

- **[L3 hardware offloading](/docs/7.24/bridging-and-switching/l3-hardware-offloading)**: Documented hardware-offloaded VRF support. A new "Hardware-Offloaded VRF" section lists which switch chips support it (98DX8xxx, 98DX4xxx, 98DX325x, 98CX8410, 98DX7xxx) and which do not (98DX3xxx, 98DX2xxx), the per-chip VRF table limits (512 or 1024), interface-association rules, and VRF assignment on ingress traffic via the new-vrf option in /interface/ethernet/switch/rule. The Marvell Prestera switch chip features page gained a matching VRF entry.
- **[Bridge](/docs/7.24/bridging-and-switching)**: Added a "DHCP Snooping Binding Table" section describing the DHCPv4 snooping binding database built on top of /interface/bridge/host, including the dhcpv4-status, dhcpv4-ip, dhcpv4-server-id, and dhcpv4-expires-after fields, MAC–VLAN identification under VLAN filtering, and WinBox/console screenshots.

## Containers

- **[Containers](/docs/7.24/containers)**: Normalized the property table's type/default formatting, fixed numbered-list indentation that was rendering incorrectly, and corrected minor grammar.
