---
title: "Documentation updates - June 15, 2026"
date: 2026-06-15
slug: /changelog-2026-06-15
source: https://manual.mikrotik.com/changelog/changelog-2026-06-15
captured_at: '2026-11-04T06:07:59+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 15, 2026.

## Authentication & AAA

- **[Certificates](/docs/authentication-authorization-accounting/certificates)**: Clarified certificate property descriptions — digest-algorithm is now described as the hash algorithm used to sign the certificate, and invalid-before/invalid-after as the validity start and expiration dates; also corrected key-usage value formatting. Part of broader wording fixes across the dot1x, PPP AAA, RADIUS, and User Manager pages.
- **[HotSpot Customisation](/docs/authentication-authorization-accounting/hotspot-captive-portal/hotspot-customisation)**: Minor corrections to the HotSpot customization guide.

## Bridging & Switching

- **[Cannot upgrade SwOS](/docs/bridging-and-switching/swos/troubleshooting)**: Added a new troubleshooting guide covering SwOS upgrade failure recovery. Includes step-by-step procedures for SwOS-only devices (CSS106, CSS326, CSS610) using hardware reset to boot into backup firmware, and dual-boot devices (CRS3xx) with serial console recovery, RouterOS CLI upgrade via /system swos upgrade, and device-mode restrictions in RouterOS 7.17+.
- **[CRS1xx/2xx series switches](/docs/bridging-and-switching/user-guides/crs1xx-2xx-series-switches-examples)**: Corrected the unicast FDB capacity wording (up to 16k MAC entries) and jumbo-frame figures. Related fixes on the L3 Hardware Offloading (default values, lpm-usage wording), MACsec example, and VLAN (disabled property description) pages.
- **[Bridging & Switching Case Studies](/docs/bridging-and-switching/user-guides/bridge-igmp-mld-snooping)**: Expanded the SDVoE acronym (Software Defined Video over Ethernet) and corrected VLAN priority values in the IGMP/MLD snooping and related case-study examples.

## Containers

- **[Container Apps](/docs/containers/apps/available-apps)**: Corrected several app descriptions in the available apps list (conduit, mediamanager, prowlarr, webtop) and clarified the network-outgoing-access parameter — when set to no, a mangle drop rule is created. Minor formatting fixes across the HAProxy, Home Assistant, Matrix Synapse, Mosquitto, ThingsBoard, and FreeRADIUS examples.
- **[Mosquitto MQTT Server](/docs/containers/user-guides/container-mosquitto-mqtt-server)**: Fixed a broken Firewall documentation link.

## Internet of Things

- **[The Things Stack](/docs/internet-of-things/lora/user-guides/the-things-stack)**: Added gateway registration steps for both the legacy UDP scenario and the modern LNS/CUPS (LoRa Basics Station) scenario, including the matching RouterOS configuration and notes on using the built-in trust store for the lora service.

## Wireless

- **[Wireless](/docs/wireless)**: Reorganized the Wireless section by product/technology family — separate Wi-Fi 6/6E (802.11ax), Wi-Fi 5 (802.11ac), and 802.11 a/b/g/n areas — with a device-routing guide on the overview page, consistent section intros, getting-started links, reciprocal CAPsMAN cross-references, and removal of outdated version notes.
- **[Wi-Fi 5 (802.11ac)](/docs/wireless/wifi-ac)**: Added a warning that wifi-qcom-ac drivers are resource-heavy, recommending the original lightweight wireless drivers for 802.11ac devices.
