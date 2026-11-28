---
title: "job"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/script/job
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## system/script/job 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="started" typ="date"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (command | login | api-login)"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="script" typ="enum"></ArgTableRow>
<ArgTableRow arg="owner" typ="string"></ArgTableRow>
<ArgTableRow arg="policy" typ="multi { array-id, policy: enum
 }"></ArgTableRow>
<ArgTableRow arg="parent" typ="num"></ArgTableRow>
<ArgTableRow arg="trace" typ="string"></ArgTableRow>
</ArgTable>
