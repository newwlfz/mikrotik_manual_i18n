# connection

> RouterOS directory reference for /tool/sniffer/connection.

-----------

## tool/sniffer/connection 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="composite { address: ipAddr
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="composite { address: ipAddr
, port: enum ()
 }"></ArgTableRow>
<ArgTableRow arg="bytes" typ="composite { in: num
, out: num
 }"></ArgTableRow>
<ArgTableRow arg="resends" typ="composite { in: num
, out: num
 }"></ArgTableRow>
<ArgTableRow arg="mss" typ="composite { in: num
, out: num
 }"></ArgTableRow>
</ArgTable>
