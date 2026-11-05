---
sidebar_key: "cli-reference/user-manager/profile"
sidebar_position: 9
title: "profile"
description: 'RouterOS directory reference for /user-manager/profile.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/user-manager/profile
captured_at: '2026-11-01T21:30:32+08:00'
---

-----------

## user-manager/profile 
**Package:** userman-5
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="validity" typ="alt { validity: enum (unlimited) { unlimited:0 }
, validity: time
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="name-for-users" typ="string"></ArgTableRow>
<ArgTableRow arg="starts-when" typ="enum (first-auth | assigned)"></ArgTableRow>
<ArgTableRow arg="price" typ="num"></ArgTableRow>
<ArgTableRow arg="override-shared-users" typ="enum (off | unlimited) { off:-1, unlimited:0 }"></ArgTableRow>
</ArgTable>
