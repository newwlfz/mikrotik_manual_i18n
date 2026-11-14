---
sidebar_key: "cli-reference/interface/wireless/info/hw-info"
sidebar_position: 5
title: "hw-info"
sidebar_label: 'hw-info'
source: https://manual.mikrotik.com/docs/cli-reference/interface/wireless/info/hw-info
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## interface/wireless/info/hw-info 
**Package:** wireless-rep
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="ranges" typ="multi { array-id, range: string
 }"></ArgTableRow>
<ArgTableRow arg="tx-chains" typ="ubit (0, 1, 2, 3)"></ArgTableRow>
<ArgTableRow arg="rx-chains" typ="ubit (0, 1, 2, 3)"></ArgTableRow>
<ArgTableRow arg="extra-info" typ="string"></ArgTableRow>
<ArgTableRow arg="locked-countries" typ="multi { array-id, country: enum
 }"></ArgTableRow>
</ArgTable>
