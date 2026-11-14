---
sidebar_key: "cli-reference/iot/modbus/transceive"
sidebar_position: 3
title: "transceive"
sidebar_label: 'transceive'
source: https://manual.mikrotik.com/docs/cli-reference/iot/modbus/transceive
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## iot/modbus/transceive 
**Package:** iot
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="num"></ArgTableRow>
<ArgTableRow arg="function" typ="num"></ArgTableRow>
<ArgTableRow arg="data" typ="string"></ArgTableRow>
<ArgTableRow arg="values" typ="multi { array-id, value: num
 }"></ArgTableRow>
<ArgTableRow arg="rx-switch-offset" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="num"></ArgTableRow>
<ArgTableRow arg="function" typ="num"></ArgTableRow>
<ArgTableRow arg="data" typ="string"></ArgTableRow>
<ArgTableRow arg="values" typ="multi { array-id, value: num
 }"></ArgTableRow>
<ArgTableRow arg="time" typ="date"></ArgTableRow>
<ArgTableRow arg="status" typ="enum (ok | error) { ok:0, error:1 }"></ArgTableRow>
<ArgTableRow arg="error" typ="num"></ArgTableRow>
<ArgTableRow arg="error-description" typ="string"></ArgTableRow>
</ArgTable>
