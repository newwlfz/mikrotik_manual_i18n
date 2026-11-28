---
sidebar_key: "cli-reference/radius/incoming/monitor"
sidebar_position: 1
title: "monitor"
sidebar_label: 'monitor'
source: https://manual.mikrotik.com/docs/cli-reference/radius/incoming/monitor
captured_at: '2026-11-28T10:14:44.799Z'
pagination_prev: "cli-reference/radius/incoming"
---

-----------

## radius/incoming/monitor 
**Type:** Command

Shows the counters of the Disconnect and CoA requests. See [RADIUS](/docs/authentication-authorization-accounting/radius) for the full guide.

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="requests" typ="num">Valid requests received.</ArgTableRow>
<ArgTableRow arg="bad-requests" typ="num">Requests dropped because of a wrong signature.</ArgTableRow>
<ArgTableRow arg="acks" typ="num">Requests answered with Disconnect-ACK or CoA-ACK.</ArgTableRow>
<ArgTableRow arg="naks" typ="num">Requests answered with Disconnect-NAK or CoA-NAK, for example when no session matches.</ArgTableRow>
</ArgTable>
