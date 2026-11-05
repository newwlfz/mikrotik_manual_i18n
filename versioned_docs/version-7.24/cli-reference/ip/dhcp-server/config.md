---
sidebar_key: "cli-reference/ip/dhcp-server/config"
sidebar_position: 2
title: "config"
description: 'RouterOS settings reference for /ip/dhcp-server/config.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/dhcp-server/config
captured_at: '2026-11-01T21:28:28+08:00'
---

-----------

## ip/dhcp-server/config 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="store-leases-disk" typ="alt { symbolic-names: enum (immediately | never) { immediately:0, never:0xffffffff }
, time-interval: time
 }"></ArgTableRow>
<ArgTableRow arg="accounting" typ="bool"></ArgTableRow>
<ArgTableRow arg="interim-update" typ="time"></ArgTableRow>
<ArgTableRow arg="radius-password" typ="alt { user: enum (empty | same-as-user)
, password: string
 }"></ArgTableRow>
</ArgTable>
