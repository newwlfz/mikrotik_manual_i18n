# monitor

> RouterOS command reference for /interface/bridge/msrp/domain/monitor.

-----------

## interface/bridge/msrp/domain/monitor 
**Conditions:** MSRP_ENABLE
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="bridge" typ="iface_enum"></ArgTableRow>
<ArgTableRow arg="id" typ="num"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="core-ports" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="boundary-ports" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
</ArgTable>
