---
sidebar_key: "cli-reference/routing/pimsm/neighbor"
sidebar_position: 7
title: "neighbor"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/pimsm/neighbor
captured_at: '2026-11-01T21:29:37+08:00'
---

-----------

## routing/pimsm/neighbor 
**Conditions:** !smips
**Type:** Directory

The neighbor menu shows all detected neighbors that are running PIM and their statuses. This menu contains dynamic and read-only entries.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="R" typ="designated-router">designated-router</ArgTableRow>
<ArgTableRow arg="J" typ="join-tracking">join-tracking</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="instance" typ="enum">Name of the PIM instance this neighbor is detected on.</ArgTableRow>
<ArgTableRow arg="address" typ="address (flags=46i)">Shows the neighbor's IP address and local interface the neighbor is detected on.</ArgTableRow>
<ArgTableRow arg="priority" typ="num">Indicates the neighbor's priority value.</ArgTableRow>
<ArgTableRow arg="timeout" typ="time">Shows the remaining time after the neighbor is removed from the list if no new Hello message is received. The hold time equals neighbor's `hello-period * 3.5`.</ArgTableRow>
<ArgTableRow arg="designated-router" typ="bool">Shows whether the neighbor is elected as Designated Router (DR).</ArgTableRow>
<ArgTableRow arg="propagation-delay" typ="time">Indicates the neighbor's value of the propagation delay in the LAN Prune Delay option in the Hello message.</ArgTableRow>
<ArgTableRow arg="override-interval" typ="time">Indicates the neighbor's value of the override interval in the LAN Prune Delay option in the Hello message.</ArgTableRow>
<ArgTableRow arg="join-tracking" typ="bool">Indicates the neighbor's value of a Tracking (T) bit in the LAN Prune Delay option in the Hello message.</ArgTableRow>
</ArgTable>
