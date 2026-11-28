---
title: "qkd-get-key"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/keymat-provider/qkd-get-key
captured_at: '2026-11-28T10:17:19.424Z'
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
