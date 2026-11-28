---
title: "save"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/sniffer/save
captured_at: '2026-11-28T10:17:19.424Z'
---

-----------

## tool/sniffer/save 
**Type:** Command

Writes the packets in memory to a file. Since RouterOS 7.20 the file is always in pcapng format, also with a `.pcap` extension; it carries the interface name, the direction and nanosecond timestamps of each packet. See [Packet sniffer](/docs/7.25/diagnostics-monitoring-and-troubleshooting/packet-sniffer).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file-name" typ="file">Name of the file to write, for example `capture.pcap`.</ArgTableRow>
</ArgTable>
