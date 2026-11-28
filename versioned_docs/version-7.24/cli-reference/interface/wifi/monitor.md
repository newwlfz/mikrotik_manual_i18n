---
title: "monitor"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/wifi/monitor
captured_at: '2026-11-28T10:19:39.818Z'
pagination_next: "cli-reference/interface/wifi/network"
---

-----------

## interface/wifi/monitor 
**Type:** Command

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="state" typ="string"></ArgTableRow>
<ArgTableRow arg="channel" typ="string"></ArgTableRow>
<ArgTableRow arg="ap-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="registered-peers" typ="num"></ArgTableRow>
<ArgTableRow arg="authorized-peers" typ="num"></ArgTableRow>
<ArgTableRow arg="tx-power" typ="num"></ArgTableRow>
<ArgTableRow arg="channel-priorities" typ="multi { array-id, channel: string
 }"></ArgTableRow>
<ArgTableRow arg="afc-status" typ="string"></ArgTableRow>
<ArgTableRow arg="afc-sp-rules" typ="multi { array-id, channel: string
 }"></ArgTableRow>
<ArgTableRow arg="hw-protection-mode" typ="enum (none | rts-cts | cts-to-self)"></ArgTableRow>
<ArgTableRow arg="mld-link-id" typ="num"></ArgTableRow>
</ArgTable>
