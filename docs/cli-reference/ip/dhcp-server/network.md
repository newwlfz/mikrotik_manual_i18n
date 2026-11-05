---
sidebar_key: "cli-reference/ip/dhcp-server/network"
sidebar_position: 6
title: "network"
source: https://manual.mikrotik.com/docs/cli-reference/ip/dhcp-server/network
captured_at: '2026-11-01T21:28:31+08:00'
---

-----------

## ip/dhcp-server/network 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="composite { address: ipAddr
, netmask: num [ .. 32]
 }"></ArgTableRow>
<ArgTableRow arg="gateway" typ="multi { address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="netmask" typ="num"></ArgTableRow>
<ArgTableRow arg="dns-server" typ="alt { server: multi { address: ipAddr
 }
 }"></ArgTableRow>
<ArgTableRow arg="dns-none" typ="bool">no servers will be sent to client</ArgTableRow>
<ArgTableRow arg="wins-server" typ="multi { address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="ntp-server" typ="alt { server: multi { address: ipAddr
 }
 }"></ArgTableRow>
<ArgTableRow arg="ntp-none" typ="bool">no servers will be sent to client</ArgTableRow>
<ArgTableRow arg="caps-manager" typ="multi { address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="domain" typ="string"></ArgTableRow>
<ArgTableRow arg="next-server" typ="ipAddr">siaddr for next bootstrap step</ArgTableRow>
<ArgTableRow arg="boot-file-name" typ="string"></ArgTableRow>
<ArgTableRow arg="dhcp-option" typ="multi { array-id, option: enum
 }"></ArgTableRow>
<ArgTableRow arg="dhcp-option-set" typ="enum (none)"></ArgTableRow>
</ArgTable>
