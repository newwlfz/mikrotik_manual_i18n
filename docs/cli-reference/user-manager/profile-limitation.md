---
sidebar_key: "cli-reference/user-manager/profile-limitation"
sidebar_position: 8
title: "profile-limitation"
sidebar_label: 'profile-limitation'
source: https://manual.mikrotik.com/docs/cli-reference/user-manager/profile-limitation
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## user-manager/profile-limitation 
**Package:** userman-5
**Type:** Directory

Connects a limitation to a profile for the given days and time of day. At a time that no limitation of the profile covers, its users cannot log in.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="profile" typ="enum" mandatory="1">Name of the profile.</ArgTableRow>
<ArgTableRow arg="limitation" typ="enum" mandatory="1">Name of the limitation.</ArgTableRow>
<ArgTableRow arg="from-time" typ="time">Time of day when the limitation starts. Default: `0s`.</ArgTableRow>
<ArgTableRow arg="till-time" typ="time">Time of day when the limitation ends. Default: `23h59m59s`.</ArgTableRow>
<ArgTableRow arg="weekdays" typ="ubit (sunday, monday, tuesday, wednesday, thursday, friday, saturday)">Days of the week when the limitation applies. Default: all days.</ArgTableRow>
</ArgTable>
