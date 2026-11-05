---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/tx-manager/index"
sidebar_position: 1
title: "tx-manager"
sidebar_label: 'tx-manager'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/qos/tx-manager
captured_at: '2026-11-01T21:27:17+08:00'
---

-----------

## interface/ethernet/switch/qos/tx-manager 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="H" typ="hw-offloaded"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">Tx Manager name</ArgTableRow>
<ArgTableRow arg="queue-buffers" typ="alt { queue-buffers-pct: num [ .. 100]
, queue-buffers-byte: num [1536 .. 67108864]
 }">The number of bytes (or %) exclusively reserved for the Tx Manager. The value gets split on active queues of assigned ports.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="hw-id" typ="num"></ArgTableRow>
</ArgTable>
