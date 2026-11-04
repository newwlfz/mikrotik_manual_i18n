---
sidebar_key: "cli-reference/interface/ethernet/switch/acl/policer"
sidebar_position: 2
title: "policer"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/acl/policer
captured_at: '2026-11-01T21:27:08+08:00'
---

-----------

## interface/ethernet/switch/acl/policer 
**Syscap:** musicswitch
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="yellow-rate" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="yellow-burst" typ="num"></ArgTableRow>
<ArgTableRow arg="red-rate" typ="num"></ArgTableRow>
<ArgTableRow arg="red-burst" typ="num"></ArgTableRow>
<ArgTableRow arg="meter-unit" typ="enum (bit | packet) { bit:0, packet:1 }"></ArgTableRow>
<ArgTableRow arg="meter-len" typ="enum (layer-1 | layer-2 | layer-3) { layer-1:0, layer-2:1, layer-3:2 }"></ArgTableRow>
<ArgTableRow arg="color-awareness" typ="bool"></ArgTableRow>
<ArgTableRow arg="bucket-coupling" typ="bool"></ArgTableRow>
<ArgTableRow arg="yellow-action" typ="enum (drop | forward | remark) { drop:0, forward:1, remark:2 }"></ArgTableRow>
<ArgTableRow arg="new-dei-for-yellow" typ="alt { spcial-dei: enum (remap) { remap:0xffffffff }
, dei: num [ .. 1]
 }"></ArgTableRow>
<ArgTableRow arg="new-pcp-for-yellow" typ="alt { special-pcp: enum (remap) { remap:0xffffffff }
, pcp: num [ .. 7]
 }"></ArgTableRow>
<ArgTableRow arg="new-dscp-for-yellow" typ="alt { special-dscp: enum (remap) { remap:0xffffffff }
, dscp: num [ .. 63]
 }"></ArgTableRow>
<ArgTableRow arg="red-action" typ="enum (drop | forward | remark) { drop:0, forward:1, remark:2 }"></ArgTableRow>
<ArgTableRow arg="new-dei-for-red" typ="alt { spcial-dei: enum (remap) { remap:0xffffffff }
, dei: num [ .. 1]
 }"></ArgTableRow>
<ArgTableRow arg="new-pcp-for-red" typ="alt { special-pcp: enum (remap) { remap:0xffffffff }
, pcp: num [ .. 7]
 }"></ArgTableRow>
<ArgTableRow arg="new-dscp-for-red" typ="alt { special-dscp: enum (remap) { remap:0xffffffff }
, dscp: num [ .. 63]
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="green-counter" typ="num"></ArgTableRow>
<ArgTableRow arg="yellow-counter" typ="num"></ArgTableRow>
<ArgTableRow arg="red-counter" typ="num"></ArgTableRow>
</ArgTable>
