---
sidebar_key: "cli-reference/ipv6/firewall/address-list"
sidebar_position: 1
title: "address-list"
source: https://manual.mikrotik.com/docs/cli-reference/ipv6/firewall/address-list
captured_at: '2026-11-01T21:29:05+08:00'
---

-----------

## ipv6/firewall/address-list 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="list" typ="enum" mandatory="1">Name of the address list where the IP address will be added.</ArgTableRow>
<ArgTableRow arg="address" typ="alt { address: ip6Prefix
, dns-name: string
 }">A single IPv6 address or prefix to add to the address list, or a DNS name.</ArgTableRow>
<ArgTableRow arg="timeout" typ="time">Time after which the address will be removed from the address list. If the timeout is not specified, the address will be stored in the address list permanently.</ArgTableRow>
<ArgTableRow arg="dynamic" typ="bool">Whether the entry is dynamically created.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="creation-time" typ="date">The time when the entry was created.</ArgTableRow>
</ArgTable>
