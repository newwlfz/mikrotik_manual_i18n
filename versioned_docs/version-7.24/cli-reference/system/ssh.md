---
sidebar_key: "cli-reference/system/ssh"
sidebar_position: 30
title: "ssh"
sidebar_label: 'ssh'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/ssh
captured_at: '2026-11-01T21:30:08+08:00'
---

-----------

## system/ssh 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { ip: ipAddr
, ipv6-address: composite { ip6: ip6Addr
, interface: [ iface_enum]
 }
 }"></ArgTableRow>
<ArgTableRow arg="command" typ="string"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ip: ipAddr
, ip6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="output-to-file" typ="string">this output method does not accept password input, use key authentication</ArgTableRow>
</ArgTable>
