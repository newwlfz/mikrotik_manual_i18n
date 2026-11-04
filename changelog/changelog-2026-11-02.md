---
title: "Documentation updates - November 2, 2026"
date: 2026-11-02T00:00:00.000Z
slug: /changelog-2026-11-02
---

# Documentation updates - November 2, 2026

November 2, 2026

Summary of documentation changes made on November 2, 2026.

## Wireless[​](#wireless "Direct link to Wireless")

-   **[WiFi CAPsMAN](/docs/7.24/wireless/wifi/capsman)**: New MLO guidance for Wi-Fi 7 CAPs. All interfaces that form an MLD must use the same SSID; a new example provisions the radios with `multi-link-mode=auto` (or `master` to keep the virtual interfaces non-MLO), and an MLO CAP needs `mld-datapath=capdp` under `/interface/wifi/cap`. For MLO with VLANs, enable only `wpa3-psk`, match the Wi-Fi 7 bands in the provisioning rules (or use one rule for all bands), and set `multi-link-mode`. CAPsMAN forwarding (`traffic-processing=on-capsman`) does not support MLO yet, which the [Wi-Fi](/docs/7.24/wireless/wifi/) `traffic-processing` description also notes. The CAP example covers both the `wifi-qcom` and `wifi-mediatek` packages.

## VPN[​](#vpn "Direct link to VPN")

-   **[IPsec](/docs/7.24/virtual-private-networks/ipsec/#route-based-ipsec-with-xfrm-interfaces)**: New "Route-based IPsec with XFRM interfaces" section. An XFRM interface is bound to an IPsec policy group, and traffic is routed into the interface instead of being matched only by the policy selectors, so dynamic routing protocols can run over the tunnel and routing marks or a VRF can steer traffic into it. A two-router example covers the configuration on both sides and how to verify it. The [`/interface/xfrm`](https://manual.mikrotik.com/docs/cli-reference/interface/xfrm) reference describes the flags and arguments (`mtu` defaults to `1400`). Also in the 7.25 manual.

## Hardware[​](#hardware "Direct link to Hardware")

-   **[NetMetal ax](/hardware/netmetal-ax)**: Corrected powering: the Ethernet port accepts passive PoE (18–28 V), not 802.3af/at. Added a specifications table (IPQ-5010 CPU, 256 MB RAM, 128 MB NAND, 2.4 and 5 GHz 802.11ax radios, a 2.5G SFP port, miniPCIe and a Nano SIM slot, operating temperature −40 °C to +70 °C).

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
