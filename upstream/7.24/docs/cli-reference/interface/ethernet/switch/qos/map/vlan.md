# vlan

> RouterOS directory reference for /interface/ethernet/switch/qos/map/vlan.

-----------

## interface/ethernet/switch/qos/map/vlan 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="H" typ="hw-offloaded"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="map" typ="enum"></ArgTableRow>
<ArgTableRow arg="pcp" typ="multi { pcp-range: range [0 .. 7]
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="dei-only" typ="bool">Map only if DEI/CFI bit is set</ArgTableRow>
<ArgTableRow arg="profile" typ="enum" mandatory="1"></ArgTableRow>
</ArgTable>
