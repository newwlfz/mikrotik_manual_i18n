---
sidebar_key: "cli-reference/ip/smb/index"
sidebar_position: 1
title: "smb"
description: 'RouterOS settings reference for /ip/smb.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/smb
captured_at: '2026-11-01T21:28:57+08:00'
---

-----------

## ip/smb 
**Conditions:** !smips
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="enum (no | auto | yes)"></ArgTableRow>
<ArgTableRow arg="domain" typ="string"></ArgTableRow>
<ArgTableRow arg="comment" typ="string"></ArgTableRow>
<ArgTableRow arg="interfaces" typ="multi { array-id, interface: iface_enum { all:0 }
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
