# settings

> RouterOS settings reference for /ip/cloud/back-to-home-file/settings.

-----------

## ip/cloud/back-to-home-file/settings 
**Syscap:** cloud-vpn
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="prefer-relay-code" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="dns-name" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="relay-rtts" typ="multi { code: string
 }"></ArgTableRow>
<ArgTableRow arg="relay-ipv4-status" typ="string"></ArgTableRow>
<ArgTableRow arg="relay-ipv6-status" typ="string"></ArgTableRow>
<ArgTableRow arg="relay-regions" typ="multi { code: string
 }"></ArgTableRow>
<ArgTableRow arg="relay-addresses" typ="multi { address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="relay-addresses-ipv6" typ="multi { address: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)"></ArgTableRow>
</ArgTable>
