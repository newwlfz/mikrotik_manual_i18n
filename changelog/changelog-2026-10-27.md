---
title: "Documentation updates - October 27, 2026"
date: 2026-10-27T00:00:00.000Z
slug: /changelog-2026-10-27
---

# Documentation updates - October 27, 2026

October 27, 2026

Summary of documentation changes made on October 27, 2026.

## User Guides[​](#user-guides "Direct link to User Guides")

-   **[RPKI](/docs/user-guides/routing-and-networking-protocols/unicast/rpki)**: Extended for ASPA and RTR protocol version 2. RouterOS starts an RTR session with version 2 and falls back to version 1 automatically; the negotiated version is shown in the `version` field of [`/routing/rpki/session`](/docs/cli-reference/routing/rpki/session). New sections cover prefix origin validation and ASPA validation: the validation states, how to verify them, and the requirements (a validator that supports RTR version 2 and publishes ASPA objects, an RFC 9234 role set with `local.role` on the eBGP connection, and `rpki-aspa-verify` in the filter chain). [Route Selection and Filtering](/docs/user-guides/routing-and-networking-protocols/route-selection-and-filtering) lists the `rpki-aspa` property and the `rpki-aspa-verify` command, and [`/routing/route`](/docs/cli-reference/routing/route) describes `rpki-aspa`.

## Bridging & Switching[​](#bridging--switching "Direct link to Bridging & Switching")

-   **[CRS3xx and CSS3xx (SwOS)](/docs/bridging-and-switching/swos/crs3)**, **[CSS106](/docs/bridging-and-switching/swos/css106)**, **[CSS610](/docs/bridging-and-switching/swos/css610)**, **[GPEN21](/docs/bridging-and-switching/swos/gpen21)**: The `DHCP with fallback` address acquisition is described with its timings. The switch sends a DHCP request every second and uses the static address while no server answers, obtains a lease 1–2 seconds after a server answers, and renews it at half the lease time. When a renewal goes unanswered, it returns to the static address within 5 seconds and resumes the requests.
-   **[L3 Hardware Offloading](/docs/bridging-and-switching/l3-hardware-offloading)**: Added notes on ECMP hash policies with L3 hardware offloading and FastPath to the feature table, [Packet Flow in RouterOS](/docs/firewall-and-quality-of-service/packet-flow-in-routeros), [Routing Decision](/docs/user-guides/routing-and-networking-protocols/routing-decision) and the `/ip/settings` and `/ipv6/settings` references. The notes were corrected on October 30.

## CLI Reference[​](#cli-reference "Direct link to CLI Reference")

-   **[CLI Reference](/docs/cli-reference/)**: Regenerated from a newer RouterOS 7.26 test build. New menus: [`/interface/wifi/easymesh`](/docs/cli-reference/interface/wifi/easymesh) with `bss`, `sta`, `topology`, `dpp-trigger` and `wps-push-button`; the `power-cycle`, `power-reset` and `reset-overcurrent` commands and the `overcurrent` counter in [`/system/resource/hardware`](/docs/cli-reference/system/resource/hardware/); and `/app/settings/remove-certificate`. New arguments include `pem` in [`/certificate/import`](/docs/cli-reference/certificate/import), `labels` and `image-labels` in [`/container`](/docs/cli-reference/container/), `lacp-strict` in bonding, `dhcp-snooping-option82-policy` and the STP topology-change counters in the bridge, `host-moves` on bridge ports, the `forced-on-a` and `forced-on-bt` PoE-out modes, and `nat-src-address6`/`nat-dst-address6` in IPFIX. The PON ONU identity fields are reworked in [`/interface/ethernet/pon`](/docs/cli-reference/interface/ethernet/pon/) (`ploam-password`, `loid`, `loid-password`, `vendor-id`, `serial-number`, `equipment-id` and more), and `/routing/stats/memory` reports `reserved`, `free` and `fragmentation`. The [`/system/routerboard/settings`](/docs/cli-reference/system/routerboard/settings) page moved and kept its descriptions. The 7.25 and 7.24 references got small fixes in the same run.

## Hardware[​](#hardware "Direct link to Hardware")

-   **[LAMP 5G R16](/hardware/lamp-5g-r16)**: New mounting instructions with pictures: pole mounting with the U-bolt (pole diameter 25–60 mm) and wall mounting (6 mm holes and wall plugs), with a warning to mount the device vertically.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
