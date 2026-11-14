---
sidebar_key: "cli-reference/ip/traffic-flow/monitor"
sidebar_position: 2
title: "monitor"
sidebar_label: 'monitor'
source: https://manual.mikrotik.com/docs/cli-reference/ip/traffic-flow/monitor
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## ip/traffic-flow/monitor 
**Type:** Command
Show the current flow-cache counters (live-updating output; stops after `duration`).

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="finished-flows" typ="num">Number of flows that expired and were exported</ArgTableRow>
<ArgTableRow arg="active-flows" typ="num">Number of flows in the cache right now</ArgTableRow>
<ArgTableRow arg="unmanaged-packets" typ="num">Packets that did not fit into any tracked flow</ArgTableRow>
<ArgTableRow arg="unmanaged-bytes" typ="num">Bytes of the unmanaged packets</ArgTableRow>
</ArgTable>
