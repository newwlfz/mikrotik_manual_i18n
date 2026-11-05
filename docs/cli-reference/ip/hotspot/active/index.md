---
sidebar_key: "cli-reference/ip/hotspot/active/index"
sidebar_position: 1
title: "active"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/hotspot/active
captured_at: '2026-11-01T21:24:02+08:00'
---

-----------

## ip/hotspot/active 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="R" typ="radius">radius</ArgTableRow>
<ArgTableRow arg="B" typ="blocked">blocked</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="server" typ="enum"></ArgTableRow>
<ArgTableRow arg="user" typ="string"></ArgTableRow>
<ArgTableRow arg="domain" typ="string"></ArgTableRow>
<ArgTableRow arg="address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="login-by" typ="string"></ArgTableRow>
<ArgTableRow arg="uptime" typ="time"></ArgTableRow>
<ArgTableRow arg="session-time-left" typ="time"></ArgTableRow>
<ArgTableRow arg="idle-time" typ="time"></ArgTableRow>
<ArgTableRow arg="idle-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="keepalive-timeout" typ="time"></ArgTableRow>
<ArgTableRow arg="bytes-in" typ="num"></ArgTableRow>
<ArgTableRow arg="bytes-out" typ="num"></ArgTableRow>
<ArgTableRow arg="packets-in" typ="num"></ArgTableRow>
<ArgTableRow arg="packets-out" typ="num"></ArgTableRow>
<ArgTableRow arg="limit-bytes-in" typ="num"></ArgTableRow>
<ArgTableRow arg="limit-bytes-out" typ="num"></ArgTableRow>
<ArgTableRow arg="limit-bytes-total" typ="num"></ArgTableRow>
<ArgTableRow arg="advertisement" typ="enum (disabled | sleeping | pending | pending,block) { disabled:0, sleeping:1, pending:2, pending,block:3 }"></ArgTableRow>
</ArgTable>
