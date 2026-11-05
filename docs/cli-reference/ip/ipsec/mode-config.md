---
sidebar_key: "cli-reference/ip/ipsec/mode-config"
sidebar_position: 5
title: "mode-config"
source: https://manual.mikrotik.com/docs/cli-reference/ip/ipsec/mode-config
captured_at: '2026-11-01T21:28:47+08:00'
---

-----------

## ip/ipsec/mode-config 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
<ArgTableRow arg="R" typ="responder">responder</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="responder" typ="bool">peer shoud request or send the config</ArgTableRow>
<ArgTableRow arg="system-dns" typ="bool">send system dns servers to peer</ArgTableRow>
<ArgTableRow arg="static-dns" typ="object { address: alt { address4: ipAddr
 }
 }">dns servers sent to peer, exclusive with system-dns</ArgTableRow>
<ArgTableRow arg="address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="address-pool" typ="enum (none) { none:-1 }">issue one address for peer from this pool</ArgTableRow>
<ArgTableRow arg="address-prefix-length" typ="num">issued address netmask</ArgTableRow>
<ArgTableRow arg="split-include" typ="object { subnet: alt { subnet4: ipPrefix
 }
 }">additional protected subnets</ArgTableRow>
<ArgTableRow arg="split-dns" typ="multi { array-id, dns: string
 }">DNS name to be resolved using internal server</ArgTableRow>
<ArgTableRow arg="src-address-list" typ="enum ()">address list name to be added to srcnat chain for initiator</ArgTableRow>
<ArgTableRow arg="connection-mark" typ="enum ()">conection-mark to be added to srcnat chain for initiator</ArgTableRow>
<ArgTableRow arg="use-responder-dns" typ="enum (no | yes | exclusively)">if the dns servers sent should be used by the initiator</ArgTableRow>
</ArgTable>
