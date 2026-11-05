---
sidebar_key: "cli-reference/ip/nat-pmp/interfaces"
sidebar_position: 2
title: "interfaces"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/nat-pmp/interfaces
captured_at: '2026-11-01T21:28:49+08:00'
---

-----------

## ip/nat-pmp/interfaces 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (external | internal)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="forced-ip" typ="super { forced-ip: ipAddr
 }"></ArgTableRow>
</ArgTable>
