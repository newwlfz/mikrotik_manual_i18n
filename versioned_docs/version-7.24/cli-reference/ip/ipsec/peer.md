---
sidebar_key: "cli-reference/ip/ipsec/peer"
sidebar_position: 6
title: "peer"
description: 'RouterOS directory reference for /ip/ipsec/peer.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/ipsec/peer
captured_at: '2026-11-01T21:28:46+08:00'
---

-----------

## ip/ipsec/peer 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="R" typ="responder">responder</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="address" typ="alt { prefix6: ip6Prefix
, prefix4: ipPrefix
, dns: string
 }"></ArgTableRow>
<ArgTableRow arg="local-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="passive" typ="bool">Passive peer won't initiate connection</ArgTableRow>
<ArgTableRow arg="port" typ="num">peer's port</ArgTableRow>
<ArgTableRow arg="profile" typ="enum"></ArgTableRow>
<ArgTableRow arg="exchange-mode" typ="enum (main | aggressive | ike2)"></ArgTableRow>
<ArgTableRow arg="send-initial-contact" typ="bool"></ArgTableRow>
<ArgTableRow arg="ppk-secret" typ="string">static PPK secret with "static-ppk-secret" ID used when no one-time key/psk exist for this peer, ensure the key has 256 bits of entropy</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="current-address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
</ArgTable>
