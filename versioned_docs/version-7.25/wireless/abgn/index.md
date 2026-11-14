---
sidebar_key: "wireless/abgn/index"
sidebar_position: 4
title: "802.11 a/b/g/n"
sidebar_label: '802.11 a/b/g/n'
description: 'MikroTik 802.11 a/b/g/n devices use the legacy /interface/wireless menu provided by the wireless package. This section covers the wireless interface, MikroTik-proprietary protocols (Nstreme, Nv2), HWMP+ mesh, interworking profiles, spectral scan, the /caps-man CAPsMAN controller, and related case studies.'
tags:
  - 'wireless'
  - '802-11abgn'
  - 'nstreme'
source: https://manual.mikrotik.com/docs/7.25/wireless/abgn
captured_at: '2026-11-04T11:23:36+08:00'
---

This section covers MikroTik **802.11 a/b/g/n** devices (and any 802.11ac device running the `wireless` package), configured through the **`/interface/wireless`** menu (the **`wireless`** driver package) — the only option on MIPS-based devices.

This menu is also where the MikroTik-specific, throughput-oriented features live — **Nstreme** and **Nv2** (TDMA), **WDS**, and **HWMP+ mesh** — as well as the original **[CAPsMAN](/docs/7.25/wireless/abgn/capsman/ap-controller-capsman)** (`/caps-man`) controller.

:::info
Some 802.11ac devices can instead run the new `/interface/wifi` menu via the `wifi-qcom-ac` package — see [Wi-Fi 5 (802.11ac)](/docs/7.25/wireless/wifi-ac/) to choose. WPA3 and fast roaming are only available through the new menu.
:::

<DocCardList />
