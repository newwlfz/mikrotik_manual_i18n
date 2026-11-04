---
sidebar_key: "cli-reference/routing/bgp/session/refresh"
sidebar_position: 4
title: "refresh"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/bgp/session/refresh
captured_at: '2026-11-01T21:29:27+08:00'
---

-----------

## routing/bgp/session/refresh 
**Conditions:** !smips
**Type:** Command

Send route refresh to a specified BGP session. Is used to trigger re-sending all the routes from the remote peer.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="afi" typ="enum (ip | ipv6 | l2vpn | vpnv4)">Specifies for which address family to send route refresh.</ArgTableRow>
</ArgTable>
