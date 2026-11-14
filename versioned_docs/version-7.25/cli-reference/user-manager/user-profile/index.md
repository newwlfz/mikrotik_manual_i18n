---
sidebar_key: "cli-reference/user-manager/user-profile/index"
sidebar_position: 2
title: "user-profile"
sidebar_label: 'user-profile'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/user-manager/user-profile
captured_at: '2026-11-01T21:26:12+08:00'
---

-----------

## user-manager/user-profile 
**Package:** userman-5
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="user" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="profile" typ="enum" mandatory="1"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="enum (waiting | running | running-active | used)"></ArgTableRow>
<ArgTableRow arg="end-time" typ="alt { constant: enum (not-yet-running | unlimited)
, date: date
 }"></ArgTableRow>
</ArgTable>
