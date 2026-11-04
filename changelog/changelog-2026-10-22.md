---
title: "Documentation updates - October 22, 2026"
date: 2026-10-22T00:00:00.000Z
slug: /changelog-2026-10-22
---

# Documentation updates - October 22, 2026

October 22, 2026

Summary of documentation changes made on October 22, 2026.

## High Availability Solutions[​](#high-availability-solutions "Direct link to High Availability Solutions")

-   **[Multi-chassis Link Aggregation Group](/docs/7.24/high-availability-solutions/multi-chassis-link-aggregation-group)**: New description of the shared system ID. MLAG uses the primary node's system ID for both the RSTP bridge ID and the LACP system ID of dual-connected bonds. When the primary node reboots, the secondary node reverts its bonds to its own LACP system ID and the LACP partner renegotiates the bond, with brief packet loss; `mlag-lacp-fallback=no` keeps the shared ID after the peer link is lost. After a reboot, `mlag-init-delay` keeps the bond slaves out of the bond until the MLAG system ID is synchronized. The [`/interface/bridge`](/docs/7.24/cli-reference/interface/bridge/) reference describes `mlag-init-delay` (default 1 minute) and `mlag-lacp-fallback` (default `yes`). Also added to the 7.25 manual.

## Diagnostics & Monitoring[​](#diagnostics--monitoring "Direct link to Diagnostics & Monitoring")

-   **[Netwatch](/docs/7.24/diagnostics-monitoring-and-troubleshooting/netwatch)**: Restored how to run a command that needs more than the Netwatch script policies: put it in a `/system/script` entry with its own `policy` and `dont-require-permissions=yes`, and call it with `/system/script/run` from the Netwatch script. Keep that script short and give it only the policies it needs.

## Management Tools[​](#management-tools "Direct link to Management Tools")

-   **[RoMON](/docs/7.24/management-tools/romon)**: Corrected: the packet sniffer and Torch show only the RoMON frames that the router sends (`tx`). Received RoMON frames do not appear, not even with `mac-protocol=romon` or `direction=rx`; to see both directions, capture on a device between the two routers, for example through a mirror port of a switch.

## Developer Guides[​](#developer-guides "Direct link to Developer Guides")

-   **[Scripting](/docs/7.24/developer-guides/scripting/)**: Corrected the scope rules again: each line typed in the interactive CLI is its own local scope, so a local variable from one line reads as an empty value (type `nothing`) on the next. Put the commands on one line or in a `{ }` block. The global variable example now declares the global at the top level, and the tip explains why declaring a global inside a block makes a script harder to read.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
