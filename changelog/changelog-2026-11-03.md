---
title: "Documentation updates - November 3, 2026"
date: 2026-11-03T00:00:00.000Z
slug: /changelog-2026-11-03
---

# Documentation updates - November 3, 2026

November 3, 2026

Summary of documentation changes made on November 3, 2026.

## Wireless[​](#wireless "Direct link to Wireless")

-   **[Configuring EasyMesh](https://manual.mikrotik.com/docs/wireless/wifi/configuring-easymesh)**: New guide for Wi-Fi EasyMesh, the Wi-Fi Alliance standard for multi-AP networks, available in the CLI on `wifi-qcom` and `wifi-qcom-ac`. It explains the controller, agent and controller-and-agent roles and the fronthaul and backhaul networks, then walks through the controller and agent configuration, onboarding over a wired backhaul or with WPS push-button over a wireless backhaul, the `topology`, `bss` and `sta` status tables, and troubleshooting. The [Wi-Fi](/docs/7.24/wireless/wifi/#wifi-easymesh) page links the guide and lists `easymesh` as a `manager` value.

## Bridging & Switching[​](#bridging--switching "Direct link to Bridging & Switching")

-   **[Bridging and Switching](/docs/7.24/bridging-and-switching/#arp-inspection-and-ip-source-guard)**: IP Source Guard blocks MAC Telnet, MAC WinBox and MAC ping on untrusted ports, because their packets carry source address `0.0.0.0` and match no DHCP snooping binding. A new warning and the `ip-source-guard` description say so, and the [MAC server](/docs/7.24/management-tools/mac-server) page notes it.
-   **[L3 Hardware Offloading](/docs/7.24/bridging-and-switching/l3-hardware-offloading#crs3xx-switch-98dx3xxx-and-98dx2xxx-series)**: The CRS3xx 98DX3xxx and 98DX2xxx section lists VRRP offloading among the features these switch chips lack, now shown as a warning.

## Containers[​](#containers "Direct link to Containers")

-   **[Apps](/docs/7.24/containers/apps/)**: The `auto-update` description says that the automatic update is triggered on device reboot.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
