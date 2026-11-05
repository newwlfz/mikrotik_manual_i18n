---
sidebar_key: "cli-reference/tool/flood-ping"
sidebar_position: 7
title: "flood-ping"
source: https://manual.mikrotik.com/docs/cli-reference/tool/flood-ping
captured_at: '2026-11-01T21:30:15+08:00'
---

-----------

## tool/flood-ping 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="count" typ="num"></ArgTableRow>
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="timeout" typ="time"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="sent" typ="num"></ArgTableRow>
<ArgTableRow arg="received" typ="num"></ArgTableRow>
<ArgTableRow arg="min-rtt" typ="time"></ArgTableRow>
<ArgTableRow arg="avg-rtt" typ="time"></ArgTableRow>
<ArgTableRow arg="max-rtt" typ="time"></ArgTableRow>
</ArgTable>
