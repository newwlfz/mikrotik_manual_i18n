---
sidebar_key: "cli-reference/routing/igmp-proxy/index"
sidebar_position: 1
title: "igmp-proxy"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/routing/igmp-proxy
captured_at: '2026-11-01T21:25:10+08:00'
---

-----------

## routing/igmp-proxy 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="robustness" typ="num">The robustness value of the IGMP proxy, used as the retransmission count for queries and the tolerance for lost packets. Interfaces without their own robustness setting inherit this value.</ArgTableRow>
<ArgTableRow arg="query-interval" typ="time">How often to send out IGMP Query messages over downstream interfaces.</ArgTableRow>
<ArgTableRow arg="query-response-interval" typ="time">How long to wait for responses to an IGMP Query message.</ArgTableRow>
<ArgTableRow arg="last-member-query-interval" typ="time">The timeout for group-specific queries sent to verify that no group members remain after a Leave message.</ArgTableRow>
</ArgTable>
