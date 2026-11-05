---
sidebar_key: "cli-reference/tool/sniffer/save"
sidebar_position: 7
title: "save"
sidebar_label: 'save'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/sniffer/save
captured_at: '2026-11-01T21:25:59+08:00'
---

-----------

## tool/sniffer/save 
**Type:** Command

Writes the packets in memory to a file. Since RouterOS 7.20 the file is always in pcapng format, also with a `.pcap` extension; it carries the interface name, the direction and nanosecond timestamps of each packet. See [Packet sniffer](/docs/diagnostics-monitoring-and-troubleshooting/packet-sniffer).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file-name" typ="file">Name of the file to write, for example `capture.pcap`.</ArgTableRow>
</ArgTable>
