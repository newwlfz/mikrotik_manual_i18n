---
sidebar_key: "cli-reference/system/keymat-provider/qkd-get-key"
sidebar_position: 2
title: "qkd-get-key"
source: https://manual.mikrotik.com/docs/cli-reference/system/keymat-provider/qkd-get-key
captured_at: '2026-11-01T21:29:51+08:00'
---

-----------

## system/keymat-provider/qkd-get-key 
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="additional-sae-ids" typ="multi { array-id, sae-id: string
 }">additional SAEs which will also get the generated key</ArgTableRow>
<ArgTableRow arg="number" typ="num">number of keys to generate</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="keys" typ="object { qkd-key: super { key-id: string
, [key] : string
 }
 }"></ArgTableRow>
</ArgTable>
