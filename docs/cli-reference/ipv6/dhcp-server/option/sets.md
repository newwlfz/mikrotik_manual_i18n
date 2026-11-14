---
sidebar_key: "cli-reference/ipv6/dhcp-server/option/sets"
sidebar_position: 1
title: "sets"
sidebar_label: 'sets'
source: https://manual.mikrotik.com/docs/cli-reference/ipv6/dhcp-server/option/sets
captured_at: '2026-11-09T11:35:47.715Z'
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
