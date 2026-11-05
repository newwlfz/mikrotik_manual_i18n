---
sidebar_key: "cli-reference/app/network"
sidebar_position: 3
title: "network"
sidebar_label: 'network'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/app/network
captured_at: '2026-11-01T21:21:41+08:00'
---

-----------

## app/network 
**Syscap:** app
**Package:** container
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="e" typ="external"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="allow-outgoing-access" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="network" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="ip" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
<ArgTableRow arg="used-ips" typ="multi { array-id, array-id, ip-and-name: composite { ip: ipAddr
, name: string
 }
 }"></ArgTableRow>
<ArgTableRow arg="bridge-interface" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="cmds" typ="multi { cmd: string
 }"></ArgTableRow>
</ArgTable>
