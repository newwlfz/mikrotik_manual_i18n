---
sidebar_key: "cli-reference/routing/igmp-proxy/interface"
sidebar_position: 2
title: "interface"
source: https://manual.mikrotik.com/docs/cli-reference/routing/igmp-proxy/interface
captured_at: '2026-11-01T21:29:32+08:00'
---

-----------

## routing/igmp-proxy/interface 
**Type:** Directory

Configure what interfaces will participate as IGMP proxy interfaces on the router. If an interface is not configured as an IGMP proxy interface, then all IGMP traffic received on it will be ignored.

It is possible to get detailed status information for each interface using the `print status` command.

```ros
[admin@MikroTik] /routing/igmp-proxy/interface/print status 
Flags: X - disabled, I - inactive, D - dynamic; U - upstream 
 0  U interface=ether2 threshold=1 alternative-subnets="" upstream=yes source-ip-address=192.168.10.10 rx-bytes=3018487500 rx-packets=2012325 tx-bytes=0 tx-packets=0 

 1    interface=ether3 threshold=1 alternative-subnets="" upstream=no querier=yes source-ip-address=192.168.20.10 rx-bytes=0 rx-packets=0 tx-bytes=2973486000 tx-packets=1982324 

 2    interface=ether4 threshold=1 alternative-subnets="" upstream=no querier=yes source-ip-address=192.168.30.10 rx-bytes=0 rx-packets=0 tx-bytes=152019000 tx-packets=101346 
```

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">inactive</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="U" typ="upstream">upstream</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum { all:0 }">Name of the interface.</ArgTableRow>
<ArgTableRow arg="threshold" typ="num">Minimal TTL. Packets received with a lower TTL value are ignored</ArgTableRow>
<ArgTableRow arg="alternative-subnets" typ="multi { numbers: super { as: ipAddr
, [netmask] /num
 }
 }">By default, only packets from directly attached subnets are accepted. This parameter can be used to specify a list of alternative valid packet source subnets, both for data and IGMP packets. Has an effect only on the upstream interface. Should be used when the source of multicast data often is in a different IP network.</ArgTableRow>
<ArgTableRow arg="upstream" typ="bool">The interface is called "upstream" if it's in the direction of the root of the multicast tree. An IGMP forwarding router must have exactly one upstream interface configured. The upstream interface is used to send out IGMP membership requests.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="querier" typ="bool">Whether the interface is acting as an IGMP querier.</ArgTableRow>
<ArgTableRow arg="source-ip-address" typ="ipAddr">The detected source IP for the interface.</ArgTableRow>
<ArgTableRow arg="rx-bytes" typ="num">The total amount of received multicast traffic on the interface.</ArgTableRow>
<ArgTableRow arg="rx-packets" typ="num">The total amount of received multicast packets on the interface.</ArgTableRow>
<ArgTableRow arg="tx-bytes" typ="num">The total amount of transmitted multicast traffic on the interface.</ArgTableRow>
<ArgTableRow arg="tx-packets" typ="num">The total amount of transmitted multicast packets on the interface.</ArgTableRow>
</ArgTable>
