---
sidebar_key: "cli-reference/system/resource/cpu"
sidebar_position: 1
title: "cpu"
sidebar_label: 'cpu'
source: https://manual.mikrotik.com/docs/cli-reference/system/resource/cpu
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## system/resource/cpu 
**Type:** Directory
Per-CPU usage breakdown of the system resource counters.

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="cpu" typ="string">Identification number of the CPU whose usage is shown</ArgTableRow>
<ArgTableRow arg="load" typ="num">CPU usage in percent</ArgTableRow>
<ArgTableRow arg="irq" typ="num">IRQ usage in percent</ArgTableRow>
<ArgTableRow arg="disk" typ="num">Disk usage in percent</ArgTableRow>
</ArgTable>
