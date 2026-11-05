---
sidebar_key: "cli-reference/disk/test"
sidebar_position: 17
title: "test"
description: 'RouterOS command reference for /disk/test.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/disk/test
captured_at: '2026-11-01T21:26:48+08:00'
---

-----------

## disk/test 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="N" typ="initializing">initializing</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
<ArgTableRow arg="F" typ="failed">failed</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="disk" typ="multi { array-id, disk: enum
 }"></ArgTableRow>
<ArgTableRow arg="block-size" typ="num"></ArgTableRow>
<ArgTableRow arg="thread-count" typ="num"></ArgTableRow>
<ArgTableRow arg="direction" typ="enum (read | write)"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (device | filesystem)"></ArgTableRow>
<ArgTableRow arg="pattern" typ="enum (sequential | random)"></ArgTableRow>
<ArgTableRow arg="entries-to-show" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="seq" typ="enum (TOT) { TOT:0xffffffff }"></ArgTableRow>
<ArgTableRow arg="rate" typ="num"></ArgTableRow>
<ArgTableRow arg="iops" typ="num"></ArgTableRow>
<ArgTableRow arg="bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="disk" typ="enum (TOT) { TOT:0xffffffff }"></ArgTableRow>
<ArgTableRow arg="thread" typ="enum (TOT) { TOT:0xffffffff }"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (device | filesystem)"></ArgTableRow>
<ArgTableRow arg="pattern" typ="enum (sequential | random)"></ArgTableRow>
<ArgTableRow arg="dir" typ="enum (read | write)"></ArgTableRow>
<ArgTableRow arg="bsize" typ="num"></ArgTableRow>
<ArgTableRow arg="state" typ="string"></ArgTableRow>
</ArgTable>
