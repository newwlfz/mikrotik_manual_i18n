---
sidebar_key: "cli-reference/tool/graphing/index"
sidebar_position: 1
title: "graphing"
sidebar_label: 'graphing'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/tool/graphing
captured_at: '2026-11-01T21:25:53+08:00'
---

-----------

## tool/graphing 
**Type:** Settings Directory

General graphing settings: how often the collected data is written to the system storage and how often the graph web pages reload. What is graphed, and who can see it, is set by the rules in [`interface`](/docs/7.25/cli-reference/tool/graphing/interface), [`queue`](/docs/7.25/cli-reference/tool/graphing/queue) and [`resource`](/docs/7.25/cli-reference/tool/graphing/resource); the router has no rules by default. See [Graphing](/docs/7.25/diagnostics-monitoring-and-troubleshooting/graphing).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="store-every" typ="enum (5min | hour | 24hours) { 5min:1, hour:2, 24hours:3 }">
How often the router writes the collected data of the rules with `store-on-disk=yes` to the system storage. A longer interval writes to the storage less often. A reboot from RouterOS keeps the data collected since the last write.
- `5min` (default) - Every 5 minutes.
- `hour` - Every hour.
- `24hours` - Once a day.
</ArgTableRow>
<ArgTableRow arg="page-refresh" typ="enum (never) { never:0x0 }">How often to refresh HTML pages (in seconds). The web server sends the value as the HTTP `refresh` header of the graph pages, so the browser reloads them. `never` leaves the header out, and the pages do not reload by themselves. Default: 300.</ArgTableRow>
</ArgTable>
