---
sidebar_key: "cli-reference/ip/hotspot/index"
sidebar_position: 4
title: "hotspot"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/hotspot
captured_at: '2026-11-01T21:24:02+08:00'
---

-----------

## ip/hotspot 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="S" typ="HTTPS">HTTPS</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="interface" typ="alt { interface: iface_enum
, interface: iface_enum
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="address-pool" typ="enum (none) { none:0 }"></ArgTableRow>
<ArgTableRow arg="profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="idle-timeout" typ="alt { symbolic-names: enum (none) { none:0 }
, time-interval: time
 }"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="alt { symbolic-names: enum (none) { none:0 }
, time-interval: time
 }"></ArgTableRow>
<ArgTableRow arg="login-timeout" typ="alt { symbolic-names: enum (none) { none:0 }
, time-interval: time
 }"></ArgTableRow>
<ArgTableRow arg="addresses-per-mac" typ="enum (unlimited) { unlimited:0 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="ip-of-dns-name" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="proxy-status" typ="string"></ArgTableRow>
</ArgTable>
