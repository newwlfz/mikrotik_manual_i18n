---
sidebar_key: "cli-reference/ipv6/dhcp-server/binding/index"
sidebar_position: 1
title: "binding"
sidebar_label: 'binding'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ipv6/dhcp-server/binding
captured_at: '2026-11-01T21:29:04+08:00'
---

-----------

## ipv6/dhcp-server/binding 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="radius">radius</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { prefix: ip6Prefix
 }">Assigns an individual address or prefix to the client</ArgTableRow>
<ArgTableRow arg="duid" typ="string" mandatory="1">hex string</ArgTableRow>
<ArgTableRow arg="iaid" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="ia-type" typ="enum (na | pd)"></ArgTableRow>
<ArgTableRow arg="server" typ="enum (all)">Name of the server that can offer this binding to the client</ArgTableRow>
<ArgTableRow arg="life-time" typ="time"></ArgTableRow>
<ArgTableRow arg="prefix-pool" typ="enum">for addresses, pool with prefix length 128</ArgTableRow>
<ArgTableRow arg="dhcp-option" typ="multi { array-id, option: alt { option: enum
, option-set: enum
 }
 }"></ArgTableRow>
<ArgTableRow arg="rate-limit" typ="string">Bit rate limit for the client</ArgTableRow>
<ArgTableRow arg="allow-dual-stack-queue" typ="bool"></ArgTableRow>
<ArgTableRow arg="address-lists" typ="multi { array-id, address-list: string
 }">Address lists to which the binding prefix/address will be added (overrides server address-lists parameter)</ArgTableRow>
<ArgTableRow arg="insert-queue-before" typ="enum (first | bottom) { first:0, bottom:0xffffffff }"></ArgTableRow>
<ArgTableRow arg="parent-queue" typ="enum (none) { none:0 }"></ArgTableRow>
<ArgTableRow arg="queue-type" typ="enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="active-server" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="status" typ="enum (waiting | offered | bound)"></ArgTableRow>
<ArgTableRow arg="expires-after" typ="time"></ArgTableRow>
<ArgTableRow arg="last-seen" typ="alt { symbolic-names: enum (never | sometime) { never:0xffffffff, sometime:0xfffffffe }
, time: time
 }"></ArgTableRow>
<ArgTableRow arg="client-address" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="reconfigure-key" typ="string"></ArgTableRow>
<ArgTableRow arg="reconfigure-last-sent" typ="string"></ArgTableRow>
<ArgTableRow arg="reconfigure-status" typ="string"></ArgTableRow>
</ArgTable>
