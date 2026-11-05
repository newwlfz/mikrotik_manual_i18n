---
sidebar_key: "cli-reference/interface/l2tp-server/monitor"
sidebar_position: 2
title: "monitor"
sidebar_label: 'monitor'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/interface/l2tp-server/monitor
captured_at: '2026-11-01T21:22:45+08:00'
---

-----------

## interface/l2tp-server/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string">Current connection status.</ArgTableRow>
<ArgTableRow arg="uptime" typ="time">Connection uptime.</ArgTableRow>
<ArgTableRow arg="user" typ="string">Authenticated user name.</ArgTableRow>
<ArgTableRow arg="caller-id" typ="string">Caller ID of the connected client.</ArgTableRow>
<ArgTableRow arg="encoding" typ="string">Encryption encoding used.</ArgTableRow>
<ArgTableRow arg="mtu" typ="num">Current MTU of the connection.</ArgTableRow>
<ArgTableRow arg="mru" typ="num">Current MRU of the connection.</ArgTableRow>
<ArgTableRow arg="local-address" typ="ipAddr">Local IP address of the connection.</ArgTableRow>
<ArgTableRow arg="remote-address" typ="ipAddr">Remote IP address of the connection.</ArgTableRow>
<ArgTableRow arg="local-ipv6-address" typ="ip6Addr">Local IPv6 address of the connection.</ArgTableRow>
<ArgTableRow arg="remote-ipv6-address" typ="ip6Addr">Remote IPv6 address of the connection.</ArgTableRow>
</ArgTable>
