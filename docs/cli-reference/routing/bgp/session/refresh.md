---
sidebar_key: "cli-reference/routing/bgp/session/refresh"
sidebar_position: 3
title: "refresh"
sidebar_label: 'refresh'
source: https://manual.mikrotik.com/docs/cli-reference/routing/bgp/session/refresh
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## routing/bgp/session/refresh 
**Conditions:** !smips
**Type:** Command

Send route refresh to a specified BGP session. Is used to trigger re-sending all the routes from the remote peer.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="afi" typ="enum (ip | ipv6 | l2vpn | vpnv4)">Specifies for which address family to send route refresh.</ArgTableRow>
</ArgTable>
