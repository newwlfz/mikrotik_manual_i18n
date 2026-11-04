---
title: "Documentation updates - June 16, 2026"
date: 2026-06-16
slug: /changelog-2026-06-16
source: https://manual.mikrotik.com/changelog/changelog-2026-06-16
captured_at: '2026-11-04T06:07:59+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 16, 2026.

## Wireless

- **[Wi-Fi 6 / 7 (802.11ax/be)](/docs/7.24/wireless/wifi)**: Retitled the WiFi page from "Wi-Fi 6 / 6E" to "Wi-Fi 6 / 7 (802.11ax/be)" and restructured the "Is this the right section?" tip into a driver-package table, documenting the new wifi-qcom-be (Wi-Fi 7, e.g. hAP be3 media) and wifi-mediatek (e.g. hAP ax S, hAP be lite) packages alongside wifi-qcom. Updated the sidebar label and the cross-references pointing at the page to match.
- **[Wireless overview](/docs/7.24/wireless)**: Added the upcoming Wi-Fi 7 driver types to the package-selection table — wifi-qcom-be and wifi-mediatek — and a WiFi 7 family entry, with hAP be lite added to the model-naming examples.
- **[Wi-Fi 5 (802.11ac)](/docs/7.24/wireless/wifi-ac)**: Clarified that wifi-qcom-ac *replaces* the wireless package rather than being installed alongside it, and softened the driver-compatibility warning.
- **[Wireless station modes](/docs/7.24/wireless/user-guides/wireless-station-modes)**: Added a wifi-qcom column to the station-mode applicability matrix and clarified that available station modes depend on the installed driver and wireless protocol.
- **[802.11 a/b/g/n](/docs/7.24/wireless/abgn)**: Review-pass corrections across the legacy /interface/wireless, CAPsMAN, W60G, and WiFi configuration guides — including the CAPsMAN upgrade-policy and rates.basic descriptions and certificate validity examples.

## Internet of Things

- **[ChirpStack](/docs/7.24/internet-of-things/lora/user-guides/chirpstack)**: New guide covering how to register MikroTik LoRaWAN gateways with the open-source ChirpStack server.

## Firewall & QoS

- **[Connection tracking](/docs/7.24/firewall-and-quality-of-service/connection-tracking)**: Review-pass corrections across the section — expanded the untracked connection-state and RAW-rule explanation, documented loose-tcp-tracking and udp-timeout, plus clarifications across NAT, filter rules, queues (CAKE, HTB, FIFO), and the DDoS-protection and port-knocking case studies.

## User Guides

- **[Routing decision](/docs/7.24/user-guides/routing-and-networking-protocols/routing-decision)**: Routing documentation review-pass corrections — clarified nexthop lookup and route redistribution via routing filters, plus fixes across BGP, OSPF, MPLS/VPLS, multicast, VRF, and the ROSv6→v7 migration pages.

## Getting Started

- **[Backup](/docs/7.24/getting-started/configuration-management/backup)**: Documented the backup encryption property (aes-sha256 / rc4) and password-encryption behavior, with further review-pass clarifications across the installation/upgrade, networking-fundamentals (IPv6), and securing-your-router pages.
- **[First time configuration](/docs/7.24/getting-started/first-time-configuration)**: Restructured the guide with updated content and new WinBox4 screenshots — clearer step-by-step flow (physical connection, downloading WinBox, finding the router via Neighbor Discovery, securing it, and user-password management) and a wireless setup split into three generations: legacy /interface wireless, modern /interface wifi, and advanced MLD / multi-radio / WiFi 6E-style setups.

## Hardware

- **[Disks](/docs/7.24/hardware/disks)**: Review-pass corrections across hardware pages — added disk sharing properties (auto-media-sharing, SMB/NFS sharing) and supported formatting filesystems, plus wording fixes on grounding, LEDs, the LCD touchscreen, PoE-out, ports, product naming, and RouterBOOT.

## Diagnostics & Monitoring

- **[Detect Internet](/docs/7.24/diagnostics-monitoring-and-troubleshooting/detect-internet)**: Review-pass corrections — clarified WAN reachability checks (cloud.mikrotik.com over UDP port 30000, checked every 2 minutes), plus fixes across logging, Netwatch, SNMP, traffic-flow, torch, and other diagnostic tools.

## High Availability Solutions

- **[Bonding](/docs/7.24/high-availability-solutions/bonding)**: Review-pass corrections to the bonding and load-balancing guides, including corrected EoIP tunnel examples.

## Developer Guides

- **[API](/docs/7.24/developer-guides/api)**: Review-pass corrections — clarified API protocol length encoding (four-byte lengths up to 0xFFFFFFFF), updated the Python 3 TLS example, and fixed the REST API and scripting pages.

## CLI Reference

- **[CLI Reference](/docs/7.24/cli-reference)**: Documented the m address flag (multicast address).

## Other sections

- **Second documentation review pass**: Spelling, grammar, wording, and factual corrections across the remaining sections — [System](/docs/7.24/system-information-and-utilities/fetch) (Fetch, e-mail, clock, device-mode, IP packing), [Storage](/docs/7.24/storage/nvme-over-tcp) (clearer NVMe-over-TCP setup, BTRFS, RAID, SMB, encrypted storage), [Network Management](/docs/7.24/network-management/dhcp) (DHCP, DNS, Cloud Back To Home / file share, web/reverse proxy, SOCKS), [Mobile Networking](/docs/7.24/mobile-networking/lte-5g) (LTE/5G, GPS, dual-SIM, SMS), [Management Tools](/docs/7.24/management-tools/tr-069) (TR-069, CLI, Quick Set, SSH, WinBox), [Internet of Things](/docs/7.24/internet-of-things/mqtt) (MQTT, Bluetooth, LoRa, GPIO, Wiliot), [Wired Connections](/docs/7.24/wired-connections/ethernet) (Ethernet, interface compatibility, PWR-Line), and [VPN](/docs/7.24/virtual-private-networks/ipsec) (IPsec, L2TP, SSTP, OpenVPN, WireGuard, PPPoE, and the tunnel guides).
- **[Wireless](/docs/7.24/wireless/wifi)**: Formatting fixes — warning messages inside tables now render correctly, and hardware model names such as hAP ac² use proper superscripts.
