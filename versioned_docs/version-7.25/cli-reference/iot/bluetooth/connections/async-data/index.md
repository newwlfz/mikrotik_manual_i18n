---
sidebar_key: "cli-reference/iot/bluetooth/connections/async-data/index"
sidebar_position: 2
title: "async-data"
sidebar_label: 'async-data'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/iot/bluetooth/connections/async-data
captured_at: '2026-11-01T21:23:33+08:00'
---

-----------

## iot/bluetooth/connections/async-data 
**Package:** iot
**Type:** Directory

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="pdev" typ="string"></ArgTableRow>
<ArgTableRow arg="uuid" typ="string"></ArgTableRow>
<ArgTableRow arg="data-text" typ="string"></ArgTableRow>
<ArgTableRow arg="data-hex" typ="string"></ArgTableRow>
<ArgTableRow arg="data-bytes" typ="multi { array-id, value: num
 }"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (notification | indication) { notification:0x01, indication:0x02 }"></ArgTableRow>
<ArgTableRow arg="time" typ="date"></ArgTableRow>
</ArgTable>
