---
sidebar_key: "cli-reference/user-manager/attribute"
sidebar_position: 2
title: "attribute"
description: 'RouterOS directory reference for /user-manager/attribute.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/user-manager/attribute
captured_at: '2026-11-01T21:30:29+08:00'
---

-----------

## user-manager/attribute 
**Package:** userman-5
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="vendor-id" typ="enum (standard | Cisco | Microsoft | Mikrotik) { standard:0, Cisco:9, Microsoft:311, Mikrotik:14988 }"></ArgTableRow>
<ArgTableRow arg="type-id" typ="num" mandatory="1"></ArgTableRow>
<ArgTableRow arg="value-type" typ="enum (ip-address | string | uint32 | hex | ip6-prefix | macro)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="packet-types" typ="ubit (access-accept, access-challenge)"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="default-name" typ="string"></ArgTableRow>
<ArgTableRow arg="standard-name" typ="string"></ArgTableRow>
</ArgTable>
