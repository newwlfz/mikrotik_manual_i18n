---
sidebar_key: "cli-reference/system/script/job"
sidebar_position: 3
title: "job"
sidebar_label: 'job'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/script/job
captured_at: '2026-11-01T21:30:07+08:00'
---

-----------

## system/script/job 
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="started" typ="date"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (command | login | api-login) { command:1, login:3, api-login:4 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="script" typ="enum"></ArgTableRow>
<ArgTableRow arg="owner" typ="string"></ArgTableRow>
<ArgTableRow arg="policy" typ="multi { array-id, policy: enum
 }"></ArgTableRow>
<ArgTableRow arg="parent" typ="num"></ArgTableRow>
<ArgTableRow arg="trace" typ="string"></ArgTableRow>
</ArgTable>
