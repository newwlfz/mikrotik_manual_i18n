# port-isolation

> RouterOS directory reference for /interface/ethernet/switch/port-isolation.

-----------

## interface/ethernet/switch/port-isolation 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ports" typ="multi { array-id }"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (src | dst) { src:0, dst:1 }"></ArgTableRow>
<ArgTableRow arg="forwarding-type" typ="ubit (bridged, routed)"></ArgTableRow>
<ArgTableRow arg="traffic-type" typ="ubit (unicast, multicast, broadcast)"></ArgTableRow>
<ArgTableRow arg="registration-status" typ="ubit (known, unknown)"></ArgTableRow>
<ArgTableRow arg="protocol-type" typ="ubit (arp, nd, dhcpv4, dhcpv6, ripv1)"></ArgTableRow>
<ArgTableRow arg="flow-id" typ="num"></ArgTableRow>
<ArgTableRow arg="mac-profile" typ="enum (promiscuous | isolated | community1 | community2) { promiscuous:0, isolated:1, community1:2, community2:3 }"></ArgTableRow>
<ArgTableRow arg="port-profile" typ="num"></ArgTableRow>
<ArgTableRow arg="vlan-profile" typ="enum (promiscuous | isolated | community1 | community2) { promiscuous:0, isolated:1, community1:2, community2:3 }"></ArgTableRow>
</ArgTable>

## interface/ethernet/switch/port-isolation 
**Syscap:** rbswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="forwarding-override" typ="multi { array-id, port: enum
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="switch" typ="enum"></ArgTableRow>
</ArgTable>
