# e-mail

> RouterOS settings reference for /tool/e-mail.

-----------

## tool/e-mail 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="server" typ="alt { ipv6: ip6Addr
, ip: ipAddr
, fqdn: string
 }"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="tls" typ="enum (no | yes | starttls)"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="from" typ="string"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="certificate-verification" typ="enum (no | yes | yes-without-crl)">TLS certificate validation</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="last-status" typ="enum (none | resolving-dns | in-progress | failed | succeeded)"></ArgTableRow>
<ArgTableRow arg="last-address" typ="alt { ip: ipAddr
, ipv6: ip6Addr
 }"></ArgTableRow>
</ArgTable>
