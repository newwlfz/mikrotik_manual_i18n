---
sidebar_key: "cli-reference/ipv6/dhcp-server/option/sets"
sidebar_position: 2
title: "sets"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ipv6/dhcp-server/option/sets
captured_at: '2026-11-01T21:24:35+08:00'
---

-----------

## ipv6/dhcp-server/option/sets 
**Type:** Directory

Groups of DHCPv6 server options that can be assigned together. For details, see [DHCPv6 Server](/docs/network-management/dhcp/dhcpv6-server).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">Name of the option set.</ArgTableRow>
<ArgTableRow arg="options" typ="multi { array-id, option: enum
 }" mandatory="1">Options (`/ipv6/dhcp-server/option`) in the set.</ArgTableRow>
</ArgTable>
