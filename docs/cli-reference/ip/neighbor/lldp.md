---
sidebar_key: "cli-reference/ip/neighbor/lldp"
sidebar_position: 3
title: "lldp"
source: https://manual.mikrotik.com/docs/cli-reference/ip/neighbor/lldp
captured_at: '2026-11-01T21:28:51+08:00'
---

-----------

## ip/neighbor/lldp 
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
<ArgTableRow arg="lldp-chassis-id-subtype" typ="enum (chassis-component | interface-alias | port-component | mac-address | network-address | interface-name | local) { chassis-component:1, interface-alias:2, port-component:3, mac-address:4, network-address:5, interface-name:6, local:7 }"></ArgTableRow>
<ArgTableRow arg="lldp-chassis-id" typ="string"></ArgTableRow>
<ArgTableRow arg="lldp-port-id-subtype" typ="enum (interface-alias | port-component | mac-address | network-address | interface-name | agent-circuit-id | local) { interface-alias:1, port-component:2, mac-address:3, network-address:4, interface-name:5, agent-circuit-id:6, local:7 }"></ArgTableRow>
<ArgTableRow arg="lldp-port-id" typ="string"></ArgTableRow>
<ArgTableRow arg="lldp-port-description" typ="string"></ArgTableRow>
<ArgTableRow arg="lldp-system-name" typ="string"></ArgTableRow>
<ArgTableRow arg="lldp-system-description" typ="string"></ArgTableRow>
<ArgTableRow arg="lldp-ttl" typ="time"></ArgTableRow>
<ArgTableRow arg="lldp-system-caps" typ="ubit (other, repeater, bridge, wlan-ap, router, telephone, docsis-cable-device, station-only)"></ArgTableRow>
<ArgTableRow arg="lldp-system-caps-enabled" typ="ubit (other, repeater, bridge, wlan-ap, router, telephone, docsis-cable-device, station-only)"></ArgTableRow>
</ArgTable>
