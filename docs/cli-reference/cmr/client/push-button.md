---
sidebar_key: "cli-reference/cmr/client/push-button"
sidebar_position: 3
title: "push-button"
sidebar_label: 'push-button'
source: https://manual.mikrotik.com/docs/cli-reference/cmr/client/push-button
captured_at: '2026-11-09T11:35:47.715Z'
pagination_next: "cli-reference/cmr/device"
---

-----------

## cmr/client/push-button 
**Type:** Command

Using this command device pairing can be performed using physical routerboard/reset button on the client device.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="multi { array-id, interface: iface_enum
 }" unset="1">Select inteface or interface list on which to search for CMR server. (default value: **all**)</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="string">State of device pairing.</ArgTableRow>
<ArgTableRow arg="error" typ="string" unset="1">Error information, in case pairing is unsuccessfull.</ArgTableRow>
<ArgTableRow arg="peer" typ="multi { array-id, mac: macAddr
 }" unset="1">CMR server address.</ArgTableRow>
<ArgTableRow arg="peer-id" typ="string" unset="1">CMR server ID.</ArgTableRow>
</ArgTable>
