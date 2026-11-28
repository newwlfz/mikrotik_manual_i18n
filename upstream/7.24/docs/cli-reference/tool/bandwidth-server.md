# bandwidth-server

> RouterOS settings reference for /tool/bandwidth-server.

-----------

## tool/bandwidth-server 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="authenticate" typ="bool"></ArgTableRow>
<ArgTableRow arg="allocate-udp-ports-from" typ="num">Beginning of UDP port range</ArgTableRow>
<ArgTableRow arg="max-sessions" typ="num">Maximal simultaneous test count</ArgTableRow>
<ArgTableRow arg="allowed-addresses4" typ="object { address: ipPrefix
 }"></ArgTableRow>
<ArgTableRow arg="allowed-addresses6" typ="object { address: ip6Prefix
 }"></ArgTableRow>
</ArgTable>
