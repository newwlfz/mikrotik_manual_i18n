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

- **[GRE/EoIP](/docs/7.24/virtual-private-networks/eoip)**, **[OpenVPN](/docs/7.24/virtual-private-networks/openvpn)**, **[L2TP](/docs/7.24/virtual-private-networks/l2tp)**, **[ZeroTier](/docs/7.24/virtual-private-networks/zerotier)**, **[WireGuard](/docs/7.24/virtual-private-networks/wireguard)**, **[IPsec](/docs/7.24/virtual-private-networks/ipsec)**, **[SSTP](/docs/7.24/virtual-private-networks/sstp)**, **[PPTP](/docs/7.24/virtual-private-networks/pptp)**, **[PPPoE](/docs/7.24/virtual-private-networks/pppoe)**, **[6to4](/docs/7.24/virtual-private-networks/6to4)**, and **[IPIP](/docs/7.24/virtual-private-networks/ipip)**: Moved CLI parameter tables into the CLI Reference and reworded the surrounding prose (also converted the IPsec page from .mdx to .md).

## High Availability Solutions

- **[Bonding](/docs/7.24/high-availability-solutions/bonding)**, **[VRRP](/docs/7.24/high-availability-solutions/vrrp)**, and **[MLAG](/docs/7.24/high-availability-solutions/multi-chassis-link-aggregation-group)**: Moved CLI parameters into the CLI Reference.

## Bridging & Switching

- **[Quality of Service](/docs/7.24/bridging-and-switching/quality-of-service)**: Moved switch QoS parameters into the CLI Reference.

## Network Management

- **[ARP](/docs/7.24/cli-reference/ip/arp)**: Removed the duplicate ARP article, consolidating its parameter descriptions into the CLI Reference.
- **[DNS](/docs/7.24/network-management/dns)**: Clarified DNS-over-HTTPS (DoH) service compatibility — added Control D to the compatible list, and reworded the "incompatible" list to reflect that those services work only on ARM64, x86, and CHR devices.

## Containers

- **[Container Mosquitto MQTT Server](/docs/7.24/containers/user-guides/container-mosquitto-mqtt-server)**: Fixed a broken link.

## System

- **[Device Mode](/docs/7.24/system-information-and-utilities/device-mode)**: Fixed a broken link.
