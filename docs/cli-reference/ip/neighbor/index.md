---
sidebar_key: "cli-reference/ip/neighbor/index"
sidebar_position: 2
title: "neighbor"
source: https://manual.mikrotik.com/docs/cli-reference/ip/neighbor
captured_at: '2026-11-01T21:28:49+08:00'
---

-----------

## ip/neighbor 
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="multi { interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="address" typ="alt { address4: ipAddr
, address6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="address4" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="address6" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="identity" typ="string"></ArgTableRow>
<ArgTableRow arg="platform" typ="string"></ArgTableRow>
<ArgTableRow arg="version" typ="string"></ArgTableRow>
<ArgTableRow arg="unpack" typ="enum (none | simple | uncompress-headers | uncompress-all) { none:0x00, simple:0x01, uncompress-headers:0x03, uncompress-all:0x07 }"></ArgTableRow>
<ArgTableRow arg="age" typ="time"></ArgTableRow>
<ArgTableRow arg="uptime" typ="time"></ArgTableRow>
<ArgTableRow arg="software-id" typ="string"></ArgTableRow>
<ArgTableRow arg="board" typ="string"></ArgTableRow>
<ArgTableRow arg="ipv6" typ="bool"></ArgTableRow>
<ArgTableRow arg="interface-name" typ="string"></ArgTableRow>
<ArgTableRow arg="system-description" typ="string"></ArgTableRow>
<ArgTableRow arg="system-caps" typ="ubit (other, repeater, bridge, wlan-ap, router, telephone, docsis-cable-device, station-only)"></ArgTableRow>
<ArgTableRow arg="system-caps-enabled" typ="ubit (other, repeater, bridge, wlan-ap, router, telephone, docsis-cable-device, station-only)"></ArgTableRow>
<ArgTableRow arg="discovered-by" typ="ubit (cdp, lldp, mndp)"></ArgTableRow>
<ArgTableRow arg="running" typ="multi { array-id, cap: string
 }" unset="1"></ArgTableRow>
</ArgTable>
