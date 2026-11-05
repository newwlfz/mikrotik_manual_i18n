---
sidebar_key: "cli-reference/ip/dhcp-server/alert/index"
sidebar_position: 1
title: "alert"
source: https://manual.mikrotik.com/docs/cli-reference/ip/dhcp-server/alert
captured_at: '2026-11-01T21:28:27+08:00'
---

-----------

## ip/dhcp-server/alert 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="valid-server" typ="multi { mac-address: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="on-alert" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="alert-timeout" typ="alt { symbolic-names: enum (none) { none:0 }
, time-interval: time
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="unknown-server" typ="multi { mac-address: macAddr
 }"></ArgTableRow>
</ArgTable>
