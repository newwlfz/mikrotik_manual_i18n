---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/tx-manager/queue"
sidebar_position: 2
title: "queue"
description: 'RouterOS directory reference for /interface/ethernet/switch/qos/tx-manager/queue.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/qos/tx-manager/queue
captured_at: '2026-11-01T21:27:18+08:00'
---

-----------

## interface/ethernet/switch/qos/tx-manager/queue 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="H" typ="hw-offloaded"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="schedule" typ="enum (strict-priority | low-priority-group | high-priority-group) { strict-priority:0, low-priority-group:1, high-priority-group:2 }">Schedule tx either by strict priority of the traffic class or round-robin within the group</ArgTableRow>
<ArgTableRow arg="weight" typ="num">Weight value for priority group</ArgTableRow>
<ArgTableRow arg="queue-buffers" typ="alt { queue-buffers-pct: num [ .. 100]
, queue-buffers-byte: num [1536 .. 67108864]
 }" syscap="!prestera-cpss">Per-queue reserved buffers. The number of bytes (or % of tx-manager) exclusively reserved for the queue.</ArgTableRow>
<ArgTableRow arg="use-shared-buffers" typ="bool" syscap="!prestera-cpss">Allow using the shared buffer pool when the port or queue buffers are full</ArgTableRow>
<ArgTableRow arg="wred" typ="bool" syscap="!prestera-ac3">Weighted Random Early Detection</ArgTableRow>
<ArgTableRow arg="ecn" typ="bool" syscap="!prestera-ac3">Explicit Congestion Notification - ECN marking</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="tx-manager" typ="enum"></ArgTableRow>
<ArgTableRow arg="traffic-class" typ="num"></ArgTableRow>
<ArgTableRow arg="wred-actual" typ="bool" syscap="!prestera-ac3">Actual WRED value</ArgTableRow>
<ArgTableRow arg="ecn-actual" typ="bool" syscap="!prestera-ac3">Actual ECN value</ArgTableRow>
</ArgTable>
