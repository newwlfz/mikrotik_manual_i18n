---
sidebar_key: "cli-reference/iot/bluetooth/index"
sidebar_position: 4
title: "bluetooth"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/iot/bluetooth
captured_at: '2026-11-01T21:28:06+08:00'
---

-----------

## iot/bluetooth 
**Package:** iot
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="offline"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="random-static-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="antenna" typ="enum (internal | external) { internal:0, external:1 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="public-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="rx-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-errors" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-errors" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-evt" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-cmd" typ="num"></ArgTableRow>
<ArgTableRow arg="rx-acl" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-acl" typ="num"></ArgTableRow>
</ArgTable>
