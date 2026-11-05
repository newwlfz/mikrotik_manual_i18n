---
sidebar_key: "cli-reference/routing/pimsm/interface"
sidebar_position: 5
title: "interface"
description: 'The interface menu shows all interfaces that are currently participating in PIM and their statuses. This menu contains dynamic and read-only entries that get created by defined interface templates.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/pimsm/interface
captured_at: '2026-11-01T21:29:37+08:00'
---

-----------

## routing/pimsm/interface 
**Conditions:** !smips
**Type:** Directory

The interface menu shows all interfaces that are currently participating in PIM and their statuses. This menu contains dynamic and read-only entries that get created by defined interface templates.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="P" typ="designated-router">designated-router</ArgTableRow>
<ArgTableRow arg="J" typ="join-tracking">join-tracking</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="instance" typ="enum"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="address" typ="address (flags=46)"></ArgTableRow>
<ArgTableRow arg="dr" typ="switch"></ArgTableRow>
<ArgTableRow arg="join-tracking" typ="switch"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="propagation-delay" typ="time"></ArgTableRow>
<ArgTableRow arg="override-interval" typ="time"></ArgTableRow>
</ArgTable>
