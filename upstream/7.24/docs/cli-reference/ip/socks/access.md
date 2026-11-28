# access

> RouterOS directory reference for /ip/socks/access.

-----------

## ip/socks/access 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="super { !
, alt-address: alt { range: ipRange
, src-ipv6: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="src-port" typ="super { !
, min: num [0 .. 65535]
, [max] -num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { !
, alt-address: alt { range: ipRange
, dst-ipv6: ip6Prefix
, dst-domain: string
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="super { !
, min: num [0 .. 65535]
, [max] -num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (deny | allow) { deny:0, allow:1 }"></ArgTableRow>
</ArgTable>
