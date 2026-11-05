---
sidebar_key: "cli-reference/system/history"
sidebar_position: 10
title: "history"
source: https://manual.mikrotik.com/docs/cli-reference/system/history
captured_at: '2026-11-01T21:29:50+08:00'
---

-----------

## system/history 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="U" typ="undoable"></ArgTableRow>
<ArgTableRow arg="R" typ="redoable"></ArgTableRow>
<ArgTableRow arg="F" typ="floating-undo"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="redo" typ="cfg"></ArgTableRow>
<ArgTableRow arg="undo" typ="cfg"></ArgTableRow>
<ArgTableRow arg="action" typ="string"></ArgTableRow>
<ArgTableRow arg="by" typ="string"></ArgTableRow>
<ArgTableRow arg="policy" typ="multi { array-id, policy: enum
 }"></ArgTableRow>
<ArgTableRow arg="time" typ="date"></ArgTableRow>
<ArgTableRow arg="trace" typ="string"></ArgTableRow>
</ArgTable>
