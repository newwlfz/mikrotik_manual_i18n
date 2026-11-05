---
sidebar_key: "cli-reference/tool/sniffer/start"
sidebar_position: 8
title: "start"
source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/start
captured_at: '2026-11-01T21:30:21+08:00'
---

-----------

## tool/sniffer/start 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="object { interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="mac-protocol" typ="object { mac-protocol-element: super { !
, protocol: alt { mac-protocol: enum ()
, protocol-number: num [ .. 65535]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="ip-protocol" typ="object { ip-protocol-element: super { !
, ip-protocol: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="object { vlan-element: super { !
, vlan: num [ .. 4095]
 }
 }"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (any | tx | rx) { any:0, tx:1, rx:2 }"></ArgTableRow>
<ArgTableRow arg="operator-between-entries" typ="enum (or | and) { or:0, and:1 }"></ArgTableRow>
<ArgTableRow arg="cpu" typ="object { cpu-element: super { !
, cpu: num
 }
 }"></ArgTableRow>
<ArgTableRow arg="size" typ="object { size-element: super { !
, size-range: range [0 .. 65535]
 }
 }"></ArgTableRow>
</ArgTable>
