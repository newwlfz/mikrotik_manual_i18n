---
sidebar_key: "cli-reference/zerotier/index"
sidebar_position: 2
title: "zerotier"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/zerotier
captured_at: '2026-11-01T21:30:37+08:00'
---

-----------

## zerotier 
**Package:** zerotier
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="R" typ="online"></ArgTableRow>
<ArgTableRow arg="F" typ="tcp-fallback"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="disabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="identity" typ="string"></ArgTableRow>
<ArgTableRow arg="interfaces" typ="multi { array-id, interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="route-distance" typ="num"></ArgTableRow>
<ArgTableRow arg="backup-priorities" typ="multi { array-id, array-id, backup-priority: composite { interface: iface_enum
, priority: num
 }
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="identity.public" typ="string"></ArgTableRow>
<ArgTableRow arg="state" typ="string"></ArgTableRow>
<ArgTableRow arg="moons" typ="multi { array-id, moon: string
 }"></ArgTableRow>
</ArgTable>
