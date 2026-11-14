---
sidebar_key: "cli-reference/tool/sniffer/quick"
sidebar_position: 5
title: "quick"
sidebar_label: 'quick'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/sniffer/quick
captured_at: '2026-11-01T21:30:22+08:00'
---

-----------

## tool/sniffer/quick 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="rows" typ="num"></ArgTableRow>
<ArgTableRow arg="show-frame" typ="bool"></ArgTableRow>
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

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="time" typ="num"></ArgTableRow>
<ArgTableRow arg="num" typ="num"></ArgTableRow>
<ArgTableRow arg="dir" typ="enum (<- | ->) { <-:0, ->:1 }"></ArgTableRow>
<ArgTableRow arg="src-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="dst-mac" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="vlan" typ="composite { id: num [ .. 4095]
, priority: num [ .. 7]
 }"></ArgTableRow>
<ArgTableRow arg="src-address" typ="composite { address: alt { ip: ipAddr
, ipv6: ip6Addr
, descr: string
 }
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="composite { address: alt { ip: ipAddr
, ipv6: ip6Addr
 }
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="protocol" typ="composite { mac-protocol: enum ()
, ip-protocol: enum (ip) { ip:0 }
 }"></ArgTableRow>
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="cpu" typ="num"></ArgTableRow>
<ArgTableRow arg="fp" typ="bool"></ArgTableRow>
<ArgTableRow arg="raw" typ="string"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="ecn" typ="num"></ArgTableRow>
<ArgTableRow arg="fragment-offset" typ="num"></ArgTableRow>
<ArgTableRow arg="identification" typ="num"></ArgTableRow>
<ArgTableRow arg="ip-header-size" typ="num"></ArgTableRow>
<ArgTableRow arg="ip-packet-size" typ="num"></ArgTableRow>
<ArgTableRow arg="tcp-flags" typ="super { tcp-flags: multi { array-id, flag: enum (fin | syn | rst | psh | ack | urg | ece | cwr) { fin:0, syn:1, rst:2, psh:3, ack:4, urg:5, ece:6, cwr:7 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="ttl" typ="num"></ArgTableRow>
</ArgTable>
