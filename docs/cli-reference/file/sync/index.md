---
sidebar_key: "cli-reference/file/sync/index"
sidebar_position: 1
title: "sync"
sidebar_label: 'sync'
source: https://manual.mikrotik.com/docs/cli-reference/file/sync
captured_at: '2026-11-01T21:26:53+08:00'
---

-----------

## file/sync 
**Package:** rose-storage
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="remote-address" typ="multi { array-id, address: string
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="mode" typ="enum (upload | download)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="local-path" typ="file"></ArgTableRow>
<ArgTableRow arg="remote-path" typ="string"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
