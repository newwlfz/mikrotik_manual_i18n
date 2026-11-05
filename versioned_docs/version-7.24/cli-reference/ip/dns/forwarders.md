---
sidebar_key: "cli-reference/ip/dns/forwarders"
sidebar_position: 3
title: "forwarders"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/dns/forwarders
captured_at: '2026-11-01T21:28:31+08:00'
---

-----------

## ip/dns/forwarders 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="dns-servers" typ="multi { address (flags=46D)
 }"></ArgTableRow>
<ArgTableRow arg="doh-servers" typ="multi { string
 }"></ArgTableRow>
<ArgTableRow arg="verify-doh-cert" typ="bool"></ArgTableRow>
</ArgTable>
