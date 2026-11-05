---
sidebar_key: "cli-reference/interface/wifi/cap"
sidebar_position: 3
title: "cap"
sidebar_label: 'cap'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wifi/cap
captured_at: '2026-11-01T21:27:44+08:00'
---

-----------

## interface/wifi/cap 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="enum (yes | no)"></ArgTableRow>
<ArgTableRow arg="discovery-interfaces" typ="multi { array-id, interface: iface_enum
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="certificate" typ="enum (request | none) { request:0 }" unset="1"></ArgTableRow>
<ArgTableRow arg="caps-man-addresses" typ="multi { array-id, address: address (flags=46iD)
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="caps-man-names" typ="multi { array-id, name: string
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="caps-man-certificate-common-names" typ="multi { array-id, common-name: string
 }" unset="1"></ArgTableRow>
<ArgTableRow arg="lock-to-caps-man" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="slaves-static" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="mld-static" typ="bool" unset="1"></ArgTableRow>
<ArgTableRow arg="slaves-datapath" typ="enum" unset="1"></ArgTableRow>
<ArgTableRow arg="mld-datapath" typ="enum" unset="1"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="requested-certificate" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="locked-caps-man-common-name" typ="string"></ArgTableRow>
<ArgTableRow arg="current-caps-man-address" typ="address (flags=46mi)"></ArgTableRow>
<ArgTableRow arg="current-caps-man-identity" typ="string"></ArgTableRow>
</ArgTable>
