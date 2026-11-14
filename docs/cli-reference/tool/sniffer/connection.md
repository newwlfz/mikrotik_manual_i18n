---
sidebar_key: "cli-reference/tool/sniffer/connection"
sidebar_position: 1
title: "connection"
sidebar_label: 'connection'
source: https://manual.mikrotik.com/docs/cli-reference/tool/sniffer/connection
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## tool/sniffer/connection 
**Type:** Directory

The TCP connections seen in the last capture. See [Packet sniffer](/docs/diagnostics-monitoring-and-troubleshooting/packet-sniffer).

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="A" typ="active">Active connection.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="src-address" typ="composite { address: ipAddr
, port: enum ()
 }">Address and port of the side that opened the connection, with the service name where known.</ArgTableRow>
<ArgTableRow arg="dst-address" typ="composite { address: ipAddr
, port: enum ()
 }">Address and port of the other side, with the service name where known, for example `192.168.88.36:80 (http)`.</ArgTableRow>
<ArgTableRow arg="bytes" typ="composite { in: num
, out: num
 }">Captured bytes sent by the source and by the destination, shown as source/destination.</ArgTableRow>
<ArgTableRow arg="resends" typ="composite { in: num
, out: num
 }">Retransmissions seen from the source and from the destination (source/destination).</ArgTableRow>
<ArgTableRow arg="mss" typ="composite { in: num
, out: num
 }">TCP maximum segment size announced by the source and by the destination (source/destination).</ArgTableRow>
</ArgTable>
