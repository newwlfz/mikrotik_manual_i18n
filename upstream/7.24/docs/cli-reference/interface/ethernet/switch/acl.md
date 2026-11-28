# acl

> RouterOS directory reference for /interface/ethernet/switch/acl.

-----------

## interface/ethernet/switch/acl 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="table" typ="enum (ingress | egress) { ingress:0, egress:1 }"></ArgTableRow>
<ArgTableRow arg="invert-match" typ="bool"></ArgTableRow>
<ArgTableRow arg="src-ports" typ="multi { array-id }"></ArgTableRow>
<ArgTableRow arg="dst-ports" typ="multi { array-id }"></ArgTableRow>
<ArgTableRow arg="service-vid" typ="super { !
, service-vid: range [ .. 4095]
 }"></ArgTableRow>
<ArgTableRow arg="service-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="service-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="customer-vid" typ="super { !
, customer-vid: range [ .. 4095]
 }"></ArgTableRow>
<ArgTableRow arg="customer-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="customer-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="src-l3-port" typ="super { !
, src-l3-port: range [ .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="dst-l3-port" typ="super { !
, dst-l3-port: range [ .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="custom-fields" typ="object { custom-field: super { !
, custom-field: super { base: enum (start-of-frame | end-of-l2-header | end-of-l3-header) { start-of-frame:0, end-of-l2-header:1, end-of-l3-header:2 }
, [offset] :num [ .. 127]
, [range] :range [ .. 65535]
, [mask] [ /num [ .. 65535]]
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="drop-precedence" typ="enum (green | yellow | red | drop)"></ArgTableRow>
<ArgTableRow arg="dst-addr-registered" typ="bool"></ArgTableRow>
<ArgTableRow arg="service-tag" typ="enum (untagged | priority-tagged | tagged | tagged-or-priority-tagged) { untagged:0, priority-tagged:1, tagged:2, tagged-or-priority-tagged:3 }"></ArgTableRow>
<ArgTableRow arg="customer-tag" typ="enum (untagged | priority-tagged | tagged | tagged-or-priority-tagged) { untagged:0, priority-tagged:1, tagged:2, tagged-or-priority-tagged:3 }"></ArgTableRow>
<ArgTableRow arg="mac-src-address" typ="super { address: macAddr
, [mask] [ /macAddr]
 }"></ArgTableRow>
<ArgTableRow arg="mac-dst-address" typ="super { address: macAddr
, [mask] [ /macAddr]
 }"></ArgTableRow>
<ArgTableRow arg="mac-protocol" typ="alt { protocol-name: enum (ip-or-ipv6 | non-ip) { ip-or-ipv6:0x10000, non-ip:0x10001 }
, protocol-number: num [ .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="lookup-vid" typ="num"></ArgTableRow>
<ArgTableRow arg="ip-protocol" typ="enum (tcp | udp | udp-lite | other) { tcp:0, udp:1, udp-lite:2, other:3 }"></ArgTableRow>
<ArgTableRow arg="fragmented" typ="bool"></ArgTableRow>
<ArgTableRow arg="first-fragment" typ="bool"></ArgTableRow>
<ArgTableRow arg="ttl" typ="enum (0 | 1 | max | other) { 0:0, 1:1, max:2, other:3 }"></ArgTableRow>
<ArgTableRow arg="ip-dst" typ="composite { address: ipAddr
, netmask: [ num [ .. 32]]
 }"></ArgTableRow>
<ArgTableRow arg="ip-src" typ="composite { address: ipAddr
, netmask: [ num [ .. 32]]
 }"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="ecn" typ="num"></ArgTableRow>
<ArgTableRow arg="ipv6-dst" typ="ip6Prefix"></ArgTableRow>
<ArgTableRow arg="ipv6-src" typ="ip6Prefix"></ArgTableRow>
<ArgTableRow arg="mac-isolation-profile" typ="enum (promiscuous | isolated | community1 | community2) { promiscuous:0, isolated:1, community1:2, community2:3 }"></ArgTableRow>
<ArgTableRow arg="src-mac-addr-state" typ="enum (sa-found | sa-not-found | dynamic-station-move | static-station-move) { sa-found:0, sa-not-found:1, dynamic-station-move:2, static-station-move:3 }"></ArgTableRow>
<ArgTableRow arg="flow-id" typ="num"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (forward | redirect-to-cpu | copy-to-cpu | send-to-new-dst-ports | drop) { forward:0, redirect-to-cpu:1, copy-to-cpu:2, send-to-new-dst-ports:3, drop:7 }"></ArgTableRow>
<ArgTableRow arg="new-dst-ports" typ="multi { array-id }"></ArgTableRow>
<ArgTableRow arg="new-flow-id" typ="num"></ArgTableRow>
<ArgTableRow arg="attack-filter-bypass" typ="bool"></ArgTableRow>
<ArgTableRow arg="ingress-vlan-filter-bypass" typ="bool"></ArgTableRow>
<ArgTableRow arg="egress-vlan-filter-bypass" typ="bool"></ArgTableRow>
<ArgTableRow arg="isolation-filter-bypass" typ="bool"></ArgTableRow>
<ArgTableRow arg="new-registered-state" typ="bool"></ArgTableRow>
<ArgTableRow arg="src-mac-learn" typ="bool"></ArgTableRow>
<ArgTableRow arg="mirror-to" typ="enum (mirror0 | mirror1) { mirror0:0, mirror1:1 }"></ArgTableRow>
<ArgTableRow arg="new-service-vid" typ="num"></ArgTableRow>
<ArgTableRow arg="new-customer-vid" typ="num"></ArgTableRow>
<ArgTableRow arg="egress-vlan-translate-bypass" typ="bool"></ArgTableRow>
<ArgTableRow arg="new-service-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="new-service-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="new-customer-pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="new-customer-dei" typ="num"></ArgTableRow>
<ArgTableRow arg="new-dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="new-priority" typ="num"></ArgTableRow>
<ArgTableRow arg="new-drop-precedence" typ="enum (green | yellow | red | drop)"></ArgTableRow>
<ArgTableRow arg="policer" typ="enum"></ArgTableRow>
</ArgTable>
