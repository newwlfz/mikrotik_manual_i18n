---
title: "service-port"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/firewall/service-port
captured_at: '2026-11-28T10:19:39.818Z'
pagination_next: "cli-reference/ip/hotspot"
---

-----------

## ip/firewall/service-port 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ports" typ="multi { port: num [0 .. 65535]
 }">Port numbers used by the service.</ArgTableRow>
<ArgTableRow arg="sip-direct-media" typ="bool">Whether SIP direct media is enabled.</ArgTableRow>
<ArgTableRow arg="sip-timeout" typ="time">SIP timeout value.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string">Name of the service.</ArgTableRow>
</ArgTable>
