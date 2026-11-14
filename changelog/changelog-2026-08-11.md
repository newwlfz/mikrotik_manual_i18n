---
title: "Documentation updates - August 11, 2026"
date: 2026-08-11
slug: /changelog-2026-08-11
source: https://manual.mikrotik.com/changelog/changelog-2026-08-11
captured_at: '2026-11-04T06:08:26+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on August 11, 2026.

## VPN

- **[GRE/EoIP](/docs/virtual-private-networks/eoip)**, **[OpenVPN](/docs/virtual-private-networks/openvpn)**, **[L2TP](/docs/virtual-private-networks/l2tp/)**, **[ZeroTier](/docs/virtual-private-networks/zerotier)**, **[WireGuard](/docs/virtual-private-networks/wireguard)**, **[IPsec](/docs/virtual-private-networks/ipsec/)**, **[SSTP](/docs/virtual-private-networks/sstp)**, **[PPTP](/docs/virtual-private-networks/pptp)**, **[PPPoE](/docs/virtual-private-networks/pppoe/)**, **[6to4](/docs/virtual-private-networks/6to4)**, and **[IPIP](/docs/virtual-private-networks/ipip)**: Moved CLI parameter tables into the CLI Reference and reworded the surrounding prose (also converted the IPsec page from .mdx to .md).

## High Availability Solutions

- **[Bonding](/docs/high-availability-solutions/bonding)**, **[VRRP](/docs/high-availability-solutions/vrrp)**, and **[MLAG](/docs/high-availability-solutions/multi-chassis-link-aggregation-group)**: Moved CLI parameters into the CLI Reference.

## Bridging & Switching

- **[Quality of Service](/docs/bridging-and-switching/quality-of-service)**: Moved switch QoS parameters into the CLI Reference.

## Network Management

- **[ARP](/docs/cli-reference/ip/arp)**: Removed the duplicate ARP article, consolidating its parameter descriptions into the CLI Reference.
- **[DNS](/docs/network-management/dns)**: Clarified DNS-over-HTTPS (DoH) service compatibility — added Control D to the compatible list, and reworded the "incompatible" list to reflect that those services work only on ARM64, x86, and CHR devices.

## Containers

- **[Container Mosquitto MQTT Server](/docs/containers/user-guides/container-mosquitto-mqtt-server)**: Fixed a broken link.

## System

- **[Device Mode](/docs/system-information-and-utilities/device-mode)**: Fixed a broken link.
