# connections

> RouterOS directory reference for /ip/proxy/connections.

-----------

## ip/proxy/connections 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="S" typ="server">server</ArgTableRow>
<ArgTableRow arg="C" typ="client">client</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="alt { ip4: ipAddr
, ip6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="alt { ip4: ipAddr
, ip6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="last-protocol" typ="enum (HTTP/1.0 | HTTP/1.1 | FTP) { HTTP/1.0:1, HTTP/1.1:2, FTP:3 }"></ArgTableRow>
<ArgTableRow arg="state" typ="enum (rx-header | resolving | connecting | waiting | rx-body | tx-header | tx-body | idle) { rx-header:0, resolving:1, connecting:2, waiting:3, rx-body:4, tx-header:5, tx-body:6, idle:7 }"></ArgTableRow>
<ArgTableRow arg="tx-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-bytes" typ="num"></ArgTableRow>
</ArgTable>
