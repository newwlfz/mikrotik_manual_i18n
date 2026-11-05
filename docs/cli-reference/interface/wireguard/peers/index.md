---
sidebar_key: "cli-reference/interface/wireguard/peers/index"
sidebar_position: 1
title: "peers"
sidebar_label: 'peers'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wireguard/peers
captured_at: '2026-11-01T21:27:55+08:00'
---

-----------

## interface/wireguard/peers 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="public-key" typ="string"></ArgTableRow>
<ArgTableRow arg="private-key" typ="alt { private-key: enum (none | auto) { none:0, auto:1 }
, private-key: string
 }"></ArgTableRow>
<ArgTableRow arg="endpoint-address" typ="address (flags=46D)"></ArgTableRow>
<ArgTableRow arg="endpoint-port" typ="num"></ArgTableRow>
<ArgTableRow arg="allowed-address" typ="multi { allowed-address: address (flags=46/)
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="preshared-key" typ="alt { preshared-key: enum (none | auto) { none:0, auto:1 }
, preshared-key: string
 }"></ArgTableRow>
<ArgTableRow arg="persistent-keepalive" typ="time"></ArgTableRow>
<ArgTableRow arg="client-address" typ="multi { client-address: address (flags=46/)
 }"></ArgTableRow>
<ArgTableRow arg="client-dns" typ="multi { client-dns: address (flags=46D)
 }"></ArgTableRow>
<ArgTableRow arg="client-endpoint" typ="address (flags=46D)"></ArgTableRow>
<ArgTableRow arg="client-keepalive" typ="time"></ArgTableRow>
<ArgTableRow arg="client-listen-port" typ="num"></ArgTableRow>
<ArgTableRow arg="client-allowed-address" typ="multi { client-allowed-address: address (flags=46/)
 }"></ArgTableRow>
<ArgTableRow arg="responder" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="current-endpoint-address" typ="address (flags=46)"></ArgTableRow>
<ArgTableRow arg="current-endpoint-port" typ="num"></ArgTableRow>
<ArgTableRow arg="rx" typ="num"></ArgTableRow>
<ArgTableRow arg="tx" typ="num"></ArgTableRow>
<ArgTableRow arg="last-handshake" typ="time"></ArgTableRow>
</ArgTable>
