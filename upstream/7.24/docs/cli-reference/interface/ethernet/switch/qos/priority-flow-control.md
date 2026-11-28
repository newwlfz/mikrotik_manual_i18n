# priority-flow-control

> RouterOS directory reference for /interface/ethernet/switch/qos/priority-flow-control.

-----------

## interface/ethernet/switch/qos/priority-flow-control 
**Syscap:** rbswitch and crs_prestera and !prestera-ac3
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="H" typ="hw-offloaded"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">PFC Profile name</ArgTableRow>
<ArgTableRow arg="traffic-class" typ="multi { array-id, tc: num [ .. 7]
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="rx" typ="bool">Receive (and obey) PFC frames</ArgTableRow>
<ArgTableRow arg="tx" typ="bool">Transmit PFC frames</ArgTableRow>
<ArgTableRow arg="pause-threshold" typ="alt { pause-threshold-pct: num [ .. 100]
, pause-threshold-byte: num [1536 .. ]
 }">Transmit a pause frame (XOFF) when the total size of queued packets reaches this threshold</ArgTableRow>
<ArgTableRow arg="resume-threshold" typ="alt { resume-threshold-pct: num [ .. 100]
, resume-threshold-byte: num [256 .. ]
 }">Transmit a resume frame (XON) when the total size of queued packets lowers down to this threshold</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="hw-id" typ="num"></ArgTableRow>
</ArgTable>
