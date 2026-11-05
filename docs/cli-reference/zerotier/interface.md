---
sidebar_key: "cli-reference/zerotier/interface"
sidebar_position: 3
title: "interface"
sidebar_label: 'interface'
source: https://manual.mikrotik.com/docs/cli-reference/zerotier/interface
captured_at: '2026-11-01T21:30:37+08:00'
---

-----------

## zerotier/interface 
**Package:** zerotier
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="R" typ="running"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="arp-timeout" typ="alt { arp-timeout: enum (auto) { auto:0 }
, arp-timeout: time
 }"></ArgTableRow>
<ArgTableRow arg="disable-running-check" typ="bool"></ArgTableRow>
<ArgTableRow arg="network" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="instance" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="allow-managed" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow-global" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow-default" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="bridge" typ="bool"></ArgTableRow>
<ArgTableRow arg="dhcp" typ="bool"></ArgTableRow>
<ArgTableRow arg="network-name" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="type" typ="string"></ArgTableRow>
</ArgTable>
