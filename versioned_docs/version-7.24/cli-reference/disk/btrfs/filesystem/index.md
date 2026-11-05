---
sidebar_key: "cli-reference/disk/btrfs/filesystem/index"
sidebar_position: 4
title: "filesystem"
sidebar_label: 'filesystem'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/disk/btrfs/filesystem
captured_at: '2026-11-01T21:26:42+08:00'
---

-----------

## disk/btrfs/filesystem 
**Conditions:** !smips
**Syscap:** storage
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="missing-devs">missing-devs</ArgTableRow>
<ArgTableRow arg="b" typ="balancing">balancing</ArgTableRow>
<ArgTableRow arg="r" typ="replacing">replacing</ArgTableRow>
<ArgTableRow arg="s" typ="scrubbing">scrubbing</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="label" typ="string"></ArgTableRow>
<ArgTableRow arg="default-subvolume" typ="enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="uuid" typ="string"></ArgTableRow>
<ArgTableRow arg="total-devs" typ="num"></ArgTableRow>
<ArgTableRow arg="dev-ids" typ="multi { array-id, devid: num
 }"></ArgTableRow>
<ArgTableRow arg="devs" typ="multi { array-id, dev: enum
 }"></ArgTableRow>
<ArgTableRow arg="spaces" typ="multi { array-id, space: string
 }"></ArgTableRow>
<ArgTableRow arg="balance-status" typ="string"></ArgTableRow>
<ArgTableRow arg="replace-status" typ="string"></ArgTableRow>
<ArgTableRow arg="scrub-status" typ="string"></ArgTableRow>
<ArgTableRow arg="write-errors" typ="multi { snapshot: num
 }"></ArgTableRow>
<ArgTableRow arg="read-errors" typ="multi { snapshot: num
 }"></ArgTableRow>
<ArgTableRow arg="flush-errors" typ="multi { snapshot: num
 }"></ArgTableRow>
<ArgTableRow arg="corruption-errors" typ="multi { snapshot: num
 }"></ArgTableRow>
<ArgTableRow arg="generation-errors" typ="multi { snapshot: num
 }"></ArgTableRow>
</ArgTable>
