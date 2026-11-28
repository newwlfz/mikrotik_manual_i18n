# static

> RouterOS directory reference for /ip/dns/static.

-----------

## ip/dns/static 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="regexp" typ="string"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (NXDOMAIN | A | NS | CNAME | MX | TXT | AAAA | SRV | FWD) { NXDOMAIN:65281, A:1, NS:2, CNAME:5, MX:15, TXT:16, AAAA:28, SRV:33, FWD:65280 }"></ArgTableRow>
<ArgTableRow arg="forward-to" typ="alt { forwarder: enum
, ip: ipAddr
, ipv6: ip6Addr
, host: string
 }"></ArgTableRow>
<ArgTableRow arg="address" typ="alt { ip: ipAddr
, ipv6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="mx-preference" typ="num"></ArgTableRow>
<ArgTableRow arg="mx-exchange" typ="string"></ArgTableRow>
<ArgTableRow arg="cname" typ="string"></ArgTableRow>
<ArgTableRow arg="text" typ="string"></ArgTableRow>
<ArgTableRow arg="ns" typ="string"></ArgTableRow>
<ArgTableRow arg="srv-priority" typ="num"></ArgTableRow>
<ArgTableRow arg="srv-weight" typ="num"></ArgTableRow>
<ArgTableRow arg="srv-port" typ="num"></ArgTableRow>
<ArgTableRow arg="srv-target" typ="string"></ArgTableRow>
<ArgTableRow arg="ttl" typ="time"></ArgTableRow>
<ArgTableRow arg="match-subdomain" typ="bool"></ArgTableRow>
<ArgTableRow arg="address-list" typ="string"></ArgTableRow>
</ArgTable>
