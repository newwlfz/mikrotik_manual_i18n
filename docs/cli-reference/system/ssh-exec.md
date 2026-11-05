---
sidebar_key: "cli-reference/system/ssh-exec"
sidebar_position: 31
title: "ssh-exec"
source: https://manual.mikrotik.com/docs/cli-reference/system/ssh-exec
captured_at: '2026-11-01T21:30:08+08:00'
---

-----------

## system/ssh-exec 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { ip: ipAddr
, ipv6-address: composite { ip6: ip6Addr
, interface: [ iface_enum]
 }
 }"></ArgTableRow>
<ArgTableRow arg="command" typ="string"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ip: ipAddr
, ip6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="output-to-file" typ="string">write output to file instead of 'output' variable</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="exit-code" typ="num"></ArgTableRow>
<ArgTableRow arg="output" typ="string"></ArgTableRow>
</ArgTable>
