# dns

> RouterOS settings reference for /ip/dns.

-----------

## ip/dns 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="servers" typ="multi { servers: address (flags=46v)
 }"></ArgTableRow>
<ArgTableRow arg="use-doh-server" typ="string"></ArgTableRow>
<ArgTableRow arg="verify-doh-cert" typ="bool"></ArgTableRow>
<ArgTableRow arg="doh-max-server-connections" typ="num"></ArgTableRow>
<ArgTableRow arg="doh-max-concurrent-queries" typ="num"></ArgTableRow>
<ArgTableRow arg="doh-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="allow-remote-requests" typ="bool"></ArgTableRow>
<ArgTableRow arg="max-udp-packet-size" typ="num"></ArgTableRow>
<ArgTableRow arg="query-server-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="query-total-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="max-concurrent-queries" typ="num"></ArgTableRow>
<ArgTableRow arg="max-concurrent-tcp-sessions" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-size" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-max-ttl" typ="time"></ArgTableRow>
<ArgTableRow arg="address-list-extra-time" typ="time"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="mdns-repeat-ifaces" typ="multi { iface_enum
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="dynamic-servers" typ="multi { dynamic-servers: address (flags=46v)
 }"></ArgTableRow>
<ArgTableRow arg="cache-used" typ="num"></ArgTableRow>
</ArgTable>
