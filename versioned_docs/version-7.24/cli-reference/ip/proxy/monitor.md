---
sidebar_key: "cli-reference/ip/proxy/monitor"
sidebar_position: 10
title: "monitor"
description: 'RouterOS command reference for /ip/proxy/monitor.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/proxy/monitor
captured_at: '2026-11-01T21:28:55+08:00'
---

-----------

## ip/proxy/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="enum (stopped | running | invalid-address | building-cache | passthrough) { stopped:0, running:1, invalid-address:4, building-cache:5 }"></ArgTableRow>
<ArgTableRow arg="uptime" typ="time"></ArgTableRow>
<ArgTableRow arg="client-connections" typ="num"></ArgTableRow>
<ArgTableRow arg="server-connections" typ="num"></ArgTableRow>
<ArgTableRow arg="requests" typ="num"></ArgTableRow>
<ArgTableRow arg="hits" typ="num"></ArgTableRow>
<ArgTableRow arg="cache-used" typ="num"></ArgTableRow>
<ArgTableRow arg="total-ram-used" typ="num"></ArgTableRow>
<ArgTableRow arg="received-from-servers" typ="num"></ArgTableRow>
<ArgTableRow arg="sent-to-clients" typ="num"></ArgTableRow>
<ArgTableRow arg="hits-sent-to-clients" typ="num"></ArgTableRow>
</ArgTable>
