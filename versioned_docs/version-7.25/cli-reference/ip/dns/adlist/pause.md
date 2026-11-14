---
sidebar_key: "cli-reference/ip/dns/adlist/pause"
sidebar_position: 1
title: "pause"
sidebar_label: 'pause'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/dns/adlist/pause
captured_at: '2026-11-01T21:23:56+08:00'
---

-----------

## ip/dns/adlist/pause 
**Type:** Command

Stops blocking by all adlists for the given time, for example `/ip/dns/adlist/pause duration=10m`. Blocking resumes by itself when the time runs out.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="duration" typ="time">How long to stop blocking. `duration=0` ends an active pause.</ArgTableRow>
</ArgTable>
