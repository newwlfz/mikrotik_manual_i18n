---
sidebar_key: "cli-reference/interface/wifi/aaa"
sidebar_position: 1
title: "aaa"
sidebar_label: 'aaa'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wifi/aaa
captured_at: '2026-11-01T21:27:44+08:00'
---

-----------

## interface/wifi/aaa 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="username-format" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="password-format" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="called-format" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="calling-format" typ="string" unset="1"></ArgTableRow>
<ArgTableRow arg="mac-caching" typ="alt { mac-caching-disable: enum (disabled) { disabled:0 }
, mac-caching-time: time
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="interim-update" typ="alt { interim-update-disable: enum (disabled) { disabled:0 }
, interim-update-time: time [1 .. ]
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="nas-identifier" typ="string" unset="1"></ArgTableRow>
</ArgTable>
