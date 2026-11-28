---
sidebar_key: "cli-reference/interface/vxlan/fdb"
sidebar_position: 1
title: "fdb"
sidebar_label: 'fdb'
source: https://manual.mikrotik.com/docs/cli-reference/interface/vxlan/fdb
captured_at: '2026-11-28T10:14:44.799Z'
pagination_prev: "cli-reference/interface/vxlan"
---

-----------

## interface/vxlan/fdb 
**Type:** Directory

Inspect the VXLAN forwarding database (FDB), which maps learned inner MAC addresses to remote VTEP addresses for unicast forwarding. See the [VXLAN guide](/docs/bridging-and-switching/vxlan) for learning and forwarding details.

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="remote-ip" typ="alt { address: ipAddr
, ipv6-address: ip6Addr
 }">IPv4 or IPv6 address of the remote VTEP from which the MAC address was learned.</ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr">Learned inner source MAC address associated with the remote VTEP.</ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum">VXLAN interface on which the MAC-to-VTEP mapping was learned.</ArgTableRow>
</ArgTable>
