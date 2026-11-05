---
sidebar_key: "cli-reference/ip/dhcp-relay/index"
sidebar_position: 1
title: "dhcp-relay"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/dhcp-relay
captured_at: '2026-11-01T21:28:27+08:00'
---

-----------

## ip/dhcp-relay 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="dhcp-server-vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="dhcp-server" typ="multi { address: ipAddr
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="delay-threshold" typ="alt { const: enum (none) { none:0 }
, time: time
 }"></ArgTableRow>
<ArgTableRow arg="local-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="add-relay-info" typ="bool"></ArgTableRow>
<ArgTableRow arg="relay-info-remote-id" typ="string"></ArgTableRow>
<ArgTableRow arg="local-address-as-src-ip" typ="bool"></ArgTableRow>
</ArgTable>
