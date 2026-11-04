---
sidebar_key: "cli-reference/system/package/local-update/update-package-source"
sidebar_position: 6
title: "update-package-source"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/package/local-update/update-package-source
captured_at: '2026-11-01T21:29:58+08:00'
---

-----------

## system/package/local-update/update-package-source 
**Type:** Directory

The server from which to get the package is defined in this list.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { ipv6: ip6Addr
, ip: ipAddr
 }" mandatory="1">IP address of the local package server.</ArgTableRow>
<ArgTableRow arg="user" typ="string" mandatory="1">Username for accessing the local package server.</ArgTableRow>
<ArgTableRow arg="password" typ="string" mandatory="1">Password for accessing the local package server.</ArgTableRow>
</ArgTable>
