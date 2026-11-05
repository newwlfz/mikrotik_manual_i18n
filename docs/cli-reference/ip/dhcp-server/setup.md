---
sidebar_key: "cli-reference/ip/dhcp-server/setup"
sidebar_position: 8
title: "setup"
source: https://manual.mikrotik.com/docs/cli-reference/ip/dhcp-server/setup
captured_at: '2026-11-01T21:28:30+08:00'
---

-----------

## ip/dhcp-server/setup 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="network" typ="composite { address: ipAddr
, netmask: num [ .. 32]
 }"></ArgTableRow>
<ArgTableRow arg="gateway" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="relay" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="ippool" typ="multi { range: composite { min: ipAddr
, max: ipAddr
 }
 }"></ArgTableRow>
<ArgTableRow arg="send-dns" typ="bool"></ArgTableRow>
<ArgTableRow arg="dns-servers" typ="multi { address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="lease-time" typ="time"></ArgTableRow>
</ArgTable>
