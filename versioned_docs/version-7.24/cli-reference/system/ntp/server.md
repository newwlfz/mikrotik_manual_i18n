---
sidebar_key: "cli-reference/system/ntp/server"
sidebar_position: 4
title: "server"
sidebar_label: 'server'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/ntp/server
captured_at: '2026-11-01T21:29:57+08:00'
---

-----------

## system/ntp/server 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="broadcast" typ="bool"></ArgTableRow>
<ArgTableRow arg="multicast" typ="bool"></ArgTableRow>
<ArgTableRow arg="manycast" typ="bool"></ArgTableRow>
<ArgTableRow arg="broadcast-addresses" typ="multi { broadcast-address: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="vrf" typ="enum"></ArgTableRow>
<ArgTableRow arg="use-local-clock" typ="bool"></ArgTableRow>
<ArgTableRow arg="local-clock-stratum" typ="num"></ArgTableRow>
<ArgTableRow arg="auth-key" typ="enum (none) { none:0 }"></ArgTableRow>
</ArgTable>
