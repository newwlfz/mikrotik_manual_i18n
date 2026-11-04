---
sidebar_key: "cli-reference/tool/sniffer/index"
sidebar_position: 3
title: "sniffer"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/sniffer
captured_at: '2026-11-01T21:30:20+08:00'
---

-----------

## tool/sniffer 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="only-headers" typ="bool"></ArgTableRow>
<ArgTableRow arg="memory-limit" typ="num"></ArgTableRow>
<ArgTableRow arg="memory-scroll" typ="bool"></ArgTableRow>
<ArgTableRow arg="file-name" typ="file"></ArgTableRow>
<ArgTableRow arg="file-limit" typ="num"></ArgTableRow>
<ArgTableRow arg="streaming-enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="streaming-server" typ="composite { ip: ipAddr
, port: [ enum ()]
 }"></ArgTableRow>
<ArgTableRow arg="max-packet-size" typ="num"></ArgTableRow>
<ArgTableRow arg="filter-stream" typ="bool"></ArgTableRow>
<ArgTableRow arg="filter-interface" typ="object { interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="filter-mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-src-mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-dst-mac-address" typ="object { mac-address-element: super { !
, mac-address-with-mask: composite { mac: macAddr
, mask: [ macAddr]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-mac-protocol" typ="object { mac-protocol-element: super { !
, protocol: alt { mac-protocol: enum ()
, protocol-number: num [ .. 65535]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-src-ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-dst-ip-address" typ="object { ip-address-element: super { !
, ip-address-with-mask: composite { ip: ipAddr
, mask: [ num [ .. 32]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-src-ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-dst-ipv6-address" typ="object { ipv6-address-element: super { !
, ipv6-prefix: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-ip-protocol" typ="object { ip-protocol-element: super { !
, ip-protocol: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-src-port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-dst-port" typ="object { port-element: super { !
, port: enum ()
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-vlan" typ="object { cpu-element: super { !
, vlan: num [ .. 4095]
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-cpu" typ="object { cpu-element: super { !
, cpu: num
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-size" typ="object { size-element: super { !
, size-range: range [0 .. 65535]
 }
 }"></ArgTableRow>
<ArgTableRow arg="filter-direction" typ="enum (any | tx | rx) { any:0, tx:1, rx:2 }"></ArgTableRow>
<ArgTableRow arg="filter-operator-between-entries" typ="enum (or | and) { or:0, and:1 }"></ArgTableRow>
<ArgTableRow arg="quick-rows" typ="num"></ArgTableRow>
<ArgTableRow arg="quick-show-frame" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="running" typ="bool"></ArgTableRow>
</ArgTable>
