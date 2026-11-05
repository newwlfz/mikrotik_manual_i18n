---
sidebar_key: "cli-reference/zerotier/peer/hint"
sidebar_position: 1
title: "hint"
description: 'RouterOS directory reference for /zerotier/peer/hint.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/zerotier/peer/hint
captured_at: '2026-11-01T21:30:37+08:00'
---

-----------

## zerotier/peer/hint 
**Package:** zerotier
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="instance" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="identity" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="addresses" typ="multi { array-id, array-id, address: composite { addr: address (flags=46)
, port: num [1 .. 65535]
 }
 }" mandatory="1"></ArgTableRow>
</ArgTable>
