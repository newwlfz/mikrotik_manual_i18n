---
sidebar_key: "cli-reference/ip/hotspot/ip-binding"
sidebar_position: 4
title: "ip-binding"
sidebar_label: 'ip-binding'
source: https://manual.mikrotik.com/docs/cli-reference/ip/hotspot/ip-binding
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## ip/hotspot/ip-binding 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="P" typ="bypassed">bypassed</ArgTableRow>
<ArgTableRow arg="B" typ="blocked">blocked</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="address" typ="ipRange"></ArgTableRow>
<ArgTableRow arg="to-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="server" typ="enum (all) { all:0 }"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (regular | bypassed | blocked) { regular:0, bypassed:1, blocked:2 }"></ArgTableRow>
</ArgTable>
