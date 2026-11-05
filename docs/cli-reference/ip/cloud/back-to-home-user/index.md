---
sidebar_key: "cli-reference/ip/cloud/back-to-home-user/index"
sidebar_position: 1
title: "back-to-home-user"
source: https://manual.mikrotik.com/docs/cli-reference/ip/cloud/back-to-home-user
captured_at: '2026-11-01T21:28:24+08:00'
---

-----------

## ip/cloud/back-to-home-user 
**Syscap:** cloud-vpn
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="A" typ="active">active</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="expires" typ="alt { expires: enum (never) { never:0xFFFFFFFF }
, interval: time
, date-time: date
 }"></ArgTableRow>
<ArgTableRow arg="allow-lan" typ="bool"></ArgTableRow>
<ArgTableRow arg="private-key" typ="string"></ArgTableRow>
<ArgTableRow arg="public-key" typ="string"></ArgTableRow>
<ArgTableRow arg="file-access" typ="enum (disabled | read-only | full)"></ArgTableRow>
<ArgTableRow arg="file-access-path" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="client-address" typ="multi { address: address (flags=46/)
 }"></ArgTableRow>
<ArgTableRow arg="file-access-token" typ="string"></ArgTableRow>
</ArgTable>
