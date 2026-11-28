---
title: "user-profile"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/user-manager/user-profile
captured_at: '2026-11-28T10:19:39.818Z'
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
