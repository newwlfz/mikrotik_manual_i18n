---
title: "Documentation updates - October 30, 2026"
date: 2026-10-30T00:00:00.000Z
slug: /changelog-2026-10-30
---

# Documentation updates - October 30, 2026

October 30, 2026

Summary of documentation changes made on October 30, 2026.

## Bridging & Switching[​](#bridging--switching "Direct link to Bridging & Switching")

-   **[L3 Hardware Offloading](/docs/bridging-and-switching/l3-hardware-offloading)**: Corrected the ECMP hashing notes. With L3 hardware offloading, hardware-forwarded ECMP uses the switch chip's own hash mask, which includes the TCP/UDP ports, and ignores the configured hash policy; FastTrack-offloaded connections follow the kernel FIB lookup and may pick a different nexthop. A new warning says that mixing hardware-forwarded and FastTrack/CPU-forwarded packets of one flow can cause asymmetric routing and connection resets. [Packet Flow in RouterOS](/docs/firewall-and-quality-of-service/packet-flow-in-routeros) explains that FastPath caches routes by destination address, so the `l4` and `l3-inner` policies do not spread FastPath-cached traffic per flow; [Routing Decision](/docs/user-guides/routing-and-networking-protocols/routing-decision) and the [`/ip/settings`](/docs/cli-reference/ip/settings) and [`/ipv6/settings`](/docs/cli-reference/ipv6/settings) references match. Also in the 7.25 and 7.24 manuals.

## High Availability Solutions[​](#high-availability-solutions "Direct link to High Availability Solutions")

-   **[VRRP](/docs/high-availability-solutions/vrrp#hardware-offloading)**: New "Hardware offloading" section. With L3 hardware offloading enabled, a VRRP instance in the master state is offloaded: the switch routes the frames sent to the virtual MAC address and uses it as the source MAC address of routed traffic, and the instance shows the `H` (`hw-offloaded`) flag, described in the [`/interface/vrrp`](/docs/cli-reference/interface/vrrp) reference. [L3 Hardware Offloading](/docs/bridging-and-switching/l3-hardware-offloading) and [Marvell Prestera switch chip features](/docs/bridging-and-switching/marvell-prestera-switch-chip-features) list VRRP as offloaded, except on the 98DX3236, 98DX224S, 98DX226S and 98DX2528 switch chips.

## User Guides[​](#user-guides "Direct link to User Guides")

-   **[Route Selection and Filtering](/docs/user-guides/routing-and-networking-protocols/route-selection-and-filtering#community-regexp-matching)**: More community regexp details: a backslash escapes one literal character (`\d` matches the letter `d`, so use `[0-9]` for digits), and matching is case-sensitive and unanchored. The `regexp` descriptions in [`community-list`](/docs/cli-reference/routing/filter/community-list), [`community-ext-list`](/docs/cli-reference/routing/filter/community-ext-list) and [`community-large-list`](/docs/cli-reference/routing/filter/community-large-list) say that regexp entries are used for matching and by `delete`/`filter`, while `append`/`set` use only concrete values.

## Diagnostics & Monitoring[​](#diagnostics--monitoring "Direct link to Diagnostics & Monitoring")

-   **[Netwatch](/docs/diagnostics-monitoring-and-troubleshooting/netwatch)**, **[Interface stats and monitor-traffic](/docs/diagnostics-monitoring-and-troubleshooting/interface-stats-and-monitor-traffic)**: New warnings that state the script policies: Netwatch scripts run with `read`, `write`, `test` and `reboot`, and `/tool/traffic-monitor` scripts with `ftp`, `reboot`, `read`, `write` and `test`. Both link to the script permissions section of the Scripting page. The Netwatch warning is also in the 7.25 and 7.24 manuals.

## CLI Reference[​](#cli-reference "Direct link to CLI Reference")

-   **[`/routing/pimsm/interface-template`](/docs/cli-reference/routing/pimsm/interface-template)**, **[`/routing/pimsm/igmp-interface-template`](/docs/cli-reference/routing/pimsm/igmp-interface-template)**: The two menus are configured separately: `interface-template` enables PIM only, and `igmp-interface-template` runs an IGMP/MLD querier, so an interface can run PIM, IGMP/MLD, or both.
-   **[CLI Reference](/docs/cli-reference/#standard-list-entry-properties)**: The `comment` property is limited to 16 KB.

## Internet of Things[​](#internet-of-things "Direct link to Internet of Things")

-   **[TG-LR Setup](/docs/internet-of-things/lora/user-guides/tg-lr-setup-guide)**: Regenerated from the TG-LR source manual. The device command descriptions are much more detailed, Configuring Sensors and Data Rules moved under Telemetry, and the Magnet Switch and Known Issues sections are expanded. The page links the uplink payload decoder script and a download of the factory default configuration commands; the TG-LRX2 utilities are now installed from PyPI (`pip install tg-lrx2-utils`) instead of a bundled archive.

## Hardware[​](#hardware "Direct link to Hardware")

-   **[FTC21-ups](/hardware/ftc21-ups)**: New manual for the weatherproof fiber-to-copper converter with a 2.5G SFP port, two Gigabit Ethernet ports (PoE-out on Ether2) and an integrated battery that rides through short power interruptions.
-   **[KNOT Gateway LR8](/hardware/l14g-2ax-bt5-lr8-and-eg800k)**, **[KNOT Gateway HL9](/hardware/l14g-2ax-bt5-hl9-and-eg800q)**: New manuals with specifications, Quickstart, wall and pole mounting, powering, cellular modem configuration and reset button sections. The HL9 is an IP66 IoT gateway with BLE 5.1, 915 MHz Wi-Fi HaLow, Wi-Fi, Gigabit Ethernet, LTE Cat 1 bis and GNSS.
-   **[IAQM-THC2PV-W and IAQM-THC2PV-G](/hardware/iaqm-thc2pv-w-and-iaqm-thc2pv-g)**: The security screw takes a T9 Torx bit, not a TA23 triangle bit.
-   **[CRS326-24G-2S+RM](/hardware/crs326-24g-2s-plus-rm)**, **[CRS317-1G-16S+RM](/hardware/crs317-1g-16s-plus-rm)**, **[CRS309-1G-8S+IN](/hardware/crs309-1g-8s-plus-in)** and 11 other CRS switch pages: Aligned with the hardware page template: a heading linked to the product page, the safety warnings as a list, Quickstart steps that link to the Mounting and Powering sections, a new specifications table on 12 of the pages, and a Reset button section where it was missing. The RouterOS/SwOS boot instructions and the Marvell Prestera features reference are now formatted as steps and links.
-   **[RouterBOARD](/docs/hardware/routerboard)**: Scripts started by the Mode or Reset button run with the `ftp`, `reboot`, `read`, `write`, `test` and `romon` policies. Also in the 7.25 and 7.24 manuals.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
