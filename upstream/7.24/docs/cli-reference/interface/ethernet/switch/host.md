# host

> RouterOS directory reference for /interface/ethernet/switch/host.

-----------

## interface/ethernet/switch/host 
**Syscap:** rbswitch and oldswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="switch" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="ports" typ="multi { array-id, port: alt { port: enum
, trunk: iface_enum
 }
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="copy-to-cpu" typ="bool"></ArgTableRow>
<ArgTableRow arg="redirect-to-cpu" typ="bool"></ArgTableRow>
<ArgTableRow arg="drop" typ="bool"></ArgTableRow>
<ArgTableRow arg="mirror" typ="bool"></ArgTableRow>
<ArgTableRow arg="vlan-id" typ="num"></ArgTableRow>
<ArgTableRow arg="share-vlan-learned" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="timeout" typ="time"></ArgTableRow>
</ArgTable>
