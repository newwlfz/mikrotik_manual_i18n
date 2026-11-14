# access

> RouterOS directory reference for /ip/proxy/access.

-----------

## ip/proxy/access 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="super { !
, range: alt { ip4: ipRange
, ip6: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-address" typ="super { !
, range: alt { ip4: ipRange
, ip6: ip6Prefix
 }
 }"></ArgTableRow>
<ArgTableRow arg="dst-port" typ="super { !
, ports: multi { ports: range [ .. 65535]
 }
 }"></ArgTableRow>
<ArgTableRow arg="local-port" typ="super { !
, port: num [0 .. 65535]
 }"></ArgTableRow>
<ArgTableRow arg="dst-host" typ="super { !
, host: string
 }"></ArgTableRow>
<ArgTableRow arg="path" typ="super { !
, path: string
 }"></ArgTableRow>
<ArgTableRow arg="method" typ="super { !
, method: enum (GET | HEAD | POST | PUT | CONNECT | OPTIONS | DELETE | TRACE)
 }"></ArgTableRow>
<ArgTableRow arg="action" typ="enum (allow | deny | redirect | url-append)"></ArgTableRow>
<ArgTableRow arg="action-data" typ="string">redirect URL/append URL</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="hits" typ="num"></ArgTableRow>
</ArgTable>
