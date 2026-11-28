---
title: "address"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/dude/ros/address
captured_at: '2026-11-28T10:19:39.818Z'
pagination_prev: "cli-reference/dude/ros"
---

-----------

## dude/ros/address 
**Package:** dude
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="invalid"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="device" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="address" typ="composite { address: ipAddr
, netmask: [ num [ .. 32]]
 }" mandatory="1"></ArgTableRow>
<ArgTableRow arg="network" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="netmask" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="broadcast" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="interface" typ="enum" mandatory="1"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="actual-interface" typ="enum"></ArgTableRow>
</ArgTable>
