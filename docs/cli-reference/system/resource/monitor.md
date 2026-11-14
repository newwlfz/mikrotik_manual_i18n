---
sidebar_key: "cli-reference/system/resource/monitor"
sidebar_position: 4
title: "monitor"
sidebar_label: 'monitor'
source: https://manual.mikrotik.com/docs/cli-reference/system/resource/monitor
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## system/resource/monitor 
**Type:** Command
Live system resource monitor output (the table keeps refreshing; stops after `duration`).

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="cpu-used" typ="num">Total CPU usage across cores</ArgTableRow>
<ArgTableRow arg="cpu-used-per-core" typ="multi { cpu-used: num
 }" syscap="smp">One line per core with its percent usage</ArgTableRow>
<ArgTableRow arg="free-memory" typ="num">Free memory in KiB</ArgTableRow>
</ArgTable>
