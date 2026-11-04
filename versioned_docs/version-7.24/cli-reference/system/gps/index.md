---
sidebar_key: "cli-reference/system/gps/index"
sidebar_position: 1
title: "gps"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/gps
captured_at: '2026-11-01T21:29:49+08:00'
---

-----------

## system/gps 
**Package:** gps
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool"></ArgTableRow>
<ArgTableRow arg="port" typ="alt { serial: enum (none)
, interface: iface_enum
 }"></ArgTableRow>
<ArgTableRow arg="channel" typ="num"></ArgTableRow>
<ArgTableRow arg="init-channel" typ="num"></ArgTableRow>
<ArgTableRow arg="init-string" typ="multi { array-id, string: string
 }"></ArgTableRow>
<ArgTableRow arg="set-system-time" typ="bool"></ArgTableRow>
<ArgTableRow arg="coordinate-format" typ="enum (dms | dd | ddmm)"></ArgTableRow>
<ArgTableRow arg="gps-antenna-select" typ="enum (internal | external) { internal:0, external:1 }" syscap="rb-gps"></ArgTableRow>
</ArgTable>
