---
sidebar_key: "cli-reference/ip/upnp/interfaces"
sidebar_position: 1
title: "interfaces"
sidebar_label: 'interfaces'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/upnp/interfaces
captured_at: '2026-11-01T21:29:00+08:00'
---

-----------

## ip/upnp/interfaces 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (external | internal) { external:1, internal:2 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="forced-ip" typ="super { forced-ip: ipAddr
 }"></ArgTableRow>
</ArgTable>
