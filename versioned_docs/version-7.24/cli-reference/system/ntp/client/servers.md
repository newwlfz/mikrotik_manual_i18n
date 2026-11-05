---
sidebar_key: "cli-reference/system/ntp/client/servers"
sidebar_position: 3
title: "servers"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/ntp/client/servers
captured_at: '2026-11-01T21:29:55+08:00'
---

-----------

## system/ntp/client/servers 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="address (flags=46D)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="min-poll" typ="num"></ArgTableRow>
<ArgTableRow arg="max-poll" typ="num"></ArgTableRow>
<ArgTableRow arg="iburst" typ="bool"></ArgTableRow>
<ArgTableRow arg="auth-key" typ="enum (none) { none:0 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="resolved-address" typ="address (flags=46)"></ArgTableRow>
</ArgTable>
