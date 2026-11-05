---
sidebar_key: "cli-reference/user/index"
sidebar_position: 5
title: "user"
sidebar_label: 'user'
source: https://manual.mikrotik.com/docs/cli-reference/user
captured_at: '2026-11-01T21:30:28+08:00'
---

-----------

## user 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="E" typ="expired">expired</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="group" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="password" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="inactivity-timeout" typ="time">period after which inactivity policy is applied</ArgTableRow>
<ArgTableRow arg="inactivity-policy" typ="enum (none | logout | lockscreen)">specify action taken after inactivity timeout</ArgTableRow>
<ArgTableRow arg="address" typ="object { address: alt { address: ipPrefix
, address: ip6Prefix
 }
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="last-logged-in" typ="date"></ArgTableRow>
</ArgTable>
