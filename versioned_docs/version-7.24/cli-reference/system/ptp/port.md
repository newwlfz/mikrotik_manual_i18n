---
sidebar_key: "cli-reference/system/ptp/port"
sidebar_position: 2
title: "port"
sidebar_label: 'port'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/system/ptp/port
captured_at: '2026-11-01T21:30:01+08:00'
---

-----------

## system/ptp/port 
**Conditions:** !smips
**Syscap:** ptp
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="ptp" typ="enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="announce-interval" typ="num"></ArgTableRow>
<ArgTableRow arg="sync-interval" typ="num"></ArgTableRow>
<ArgTableRow arg="delay-interval" typ="num"></ArgTableRow>
<ArgTableRow arg="pdelay-interval" typ="num"></ArgTableRow>
</ArgTable>
