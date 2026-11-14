---
sidebar_key: "cli-reference/iot/lora/servers/index"
sidebar_position: 1
title: "servers"
sidebar_label: 'servers'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/iot/lora/servers
captured_at: '2026-11-01T21:28:15+08:00'
---

-----------

## iot/lora/servers 
**Package:** iot
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="address" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="up-port" typ="num"></ArgTableRow>
<ArgTableRow arg="down-port" typ="num"></ArgTableRow>
<ArgTableRow arg="key" typ="string"></ArgTableRow>
<ArgTableRow arg="port" typ="num"></ArgTableRow>
<ArgTableRow arg="interval" typ="num"></ArgTableRow>
<ArgTableRow arg="ssl" typ="bool"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="protocol" typ="enum (UDP | LNS | CUPS)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="netid" typ="multi { netid: enum
 }"></ArgTableRow>
<ArgTableRow arg="joineui" typ="multi { joineui: enum
 }"></ArgTableRow>
</ArgTable>
