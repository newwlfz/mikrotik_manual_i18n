---
sidebar_key: "cli-reference/interface/w60g/monitor"
sidebar_position: 3
title: "monitor"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/w60g/monitor
captured_at: '2026-11-01T21:27:42+08:00'
---

-----------

## interface/w60g/monitor 
**Syscap:** 60ghz
**Package:** wireless-rep
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="connected" typ="bool"></ArgTableRow>
<ArgTableRow arg="frequency" typ="num"></ArgTableRow>
<ArgTableRow arg="remote-address" typ="multi { array-id, remote-address: macAddr
 }"></ArgTableRow>
<ArgTableRow arg="tx-mcs" typ="multi { array-id, tx-mcs: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-phy-rate" typ="multi { array-id, tx-phy-rate: num
 }"></ArgTableRow>
<ArgTableRow arg="signal" typ="multi { array-id, signal: num
 }"></ArgTableRow>
<ArgTableRow arg="rssi" typ="multi { array-id, rssi: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-sector" typ="multi { array-id, tx-sector: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-sector-info" typ="multi { array-id, tx-sector-info: string
 }"></ArgTableRow>
<ArgTableRow arg="distance" typ="multi { array-id, distance: num
 }"></ArgTableRow>
<ArgTableRow arg="baseband-temperature" typ="num"></ArgTableRow>
<ArgTableRow arg="rf-temperature" typ="multi { array-id, rf-temperature: num
 }"></ArgTableRow>
<ArgTableRow arg="tx-packet-error-rate" typ="num"></ArgTableRow>
</ArgTable>
