---
sidebar_key: "cli-reference/ip/pool/used"
sidebar_position: 2
title: "used"
source: https://manual.mikrotik.com/docs/cli-reference/ip/pool/used
captured_at: '2026-11-01T21:28:52+08:00'
---

-----------

## ip/pool/used 
**Type:** Directory

Menu lists all used IP addresses from IP pools.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="pool" typ="enum">Name of the IP pool.</ArgTableRow>
<ArgTableRow arg="address" typ="ipAddr">IP address that is assigned to a client from the pool.</ArgTableRow>
<ArgTableRow arg="owner" typ="string">Name of the service which acquired this IP address.</ArgTableRow>
<ArgTableRow arg="info" typ="string">Additional info, for example, for DHCP - MAC address from the leases menu and for PPP - connections username of a PPP type client.</ArgTableRow>
</ArgTable>
