---
sidebar_key: "cli-reference/tool/mac-server/ping"
sidebar_position: 2
title: "ping"
sidebar_label: 'ping'
source: https://manual.mikrotik.com/docs/cli-reference/tool/mac-server/ping
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## tool/mac-server/ping 
**Type:** Settings Directory

MAC ping server settings. With the server enabled, the router answers pings sent to its MAC address (`/ping <MAC address>`). For examples, see [MAC server](/docs/management-tools/mac-server).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Whether the router answers MAC pings. It is also needed for the router's own MAC pings: with the server disabled, they fail with the status `unknown interface`. ARP ping does not depend on this setting. Default: yes.</ArgTableRow>
</ArgTable>
