---
sidebar_key: "cli-reference/ip/smb/shares"
sidebar_position: 2
title: "shares"
description: 'RouterOS directory reference for /ip/smb/shares.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/smb/shares
captured_at: '2026-11-01T21:28:56+08:00'
---

-----------

## ip/smb/shares 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="*" typ="default">default</ArgTableRow>
<ArgTableRow arg="r" typ="read-only">read-only</ArgTableRow>
<ArgTableRow arg="c" typ="require-encryption">require-encryption</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="directory" typ="file"></ArgTableRow>
<ArgTableRow arg="read-only" typ="bool"></ArgTableRow>
<ArgTableRow arg="require-encryption" typ="bool"></ArgTableRow>
<ArgTableRow arg="valid-users" typ="multi { array-id, user: enum
 }"></ArgTableRow>
<ArgTableRow arg="invalid-users" typ="multi { array-id, user: enum
 }"></ArgTableRow>
</ArgTable>
