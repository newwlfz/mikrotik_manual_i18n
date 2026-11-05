---
sidebar_key: "cli-reference/interface/ethernet/switch/rule/index"
sidebar_position: 1
title: "rule"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/rule
captured_at: '2026-11-01T21:27:18+08:00'
---

-----------

## interface/ethernet/switch/rule 
**Syscap:** rbswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="switch" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ports" typ="multi { array-id, port: enum
 }" syscap="!crs_prestera"></ArgTableRow>
<ArgTableRow arg="src-mac-address" typ="super { address: macAddr
, [mask] /macAddr
 }"></ArgTableRow>
<ArgTableRow arg="dst-mac-address" typ="super { address: macAddr
, [mask] /macAddr
 }"></ArgTableRow>
<ArgTableRow arg="mac-protocol" typ="alt { protocol-name: enum ()
, protocol-number: num [ .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="vlan-header" typ="enum (not-present | present)"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="vlan-priority" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address" typ="super { address: ipAddr
, [mask] /alt { bitmask: ipAddr
, netmask: num [ .. 32]
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { address: ipAddr
, [mask] /alt { bitmask: ipAddr
, netmask: num [ .. 32]
 }
 }"></ArgTableRow>
<ArgTableRow arg="protocol" typ="alt { protocol-name: enum ()
, protocol-number: num [ .. 255]
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="range"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="range"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address6" typ="super { address: ip6Addr
, [mask] /alt { bitmask: ip6Addr
, netmask: num
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-address6" typ="super { address: ip6Addr
, [mask] /alt { bitmask: ip6Addr
, netmask: num
 }
 }"></ArgTableRow>
<ArgTableRow arg="traffic-class" typ="num"></ArgTableRow>
<ArgTableRow arg="flow-label" typ="num"></ArgTableRow>
<ArgTableRow arg="copy-to-cpu" typ="bool"></ArgTableRow>
<ArgTableRow arg="redirect-to-cpu" typ="bool"></ArgTableRow>
<ArgTableRow arg="mirror" typ="bool" syscap="switch-mirror-prestera"></ArgTableRow>
<ArgTableRow arg="new-dst-ports" typ="multi { array-id, port: alt { port: enum
, bond: iface_enum
 }
 }">Set new-dst-ports to an empty string to drop packets on the hardware level</ArgTableRow>
<ArgTableRow arg="mirror-ports" typ="multi { array-id, port: enum
 }" syscap="switch-mv88e6xxx"></ArgTableRow>
<ArgTableRow arg="new-qos-profile" typ="enum" syscap="crs_prestera">Assign QoS profile to the matched packets</ArgTableRow>
<ArgTableRow arg="keep-qos-fields" typ="bool" syscap="crs_prestera">Keep the original QoS fields (PCP, DSCP) or replace them from the QoS profile?</ArgTableRow>
<ArgTableRow arg="new-vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="new-vlan-priority" typ="num"></ArgTableRow>
<ArgTableRow arg="new-vrf" typ="enum" syscap="crs_prestera">Assign VRF to the matched packets</ArgTableRow>
<ArgTableRow arg="rate" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="internal-priority" typ="num"></ArgTableRow>
</ArgTable>
