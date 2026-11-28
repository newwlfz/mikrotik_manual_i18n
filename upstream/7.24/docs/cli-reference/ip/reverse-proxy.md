# reverse-proxy

> RouterOS directory reference for /ip/reverse-proxy.

-----------

## ip/reverse-proxy 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="sni" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ip-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="port" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
</ArgTable>
