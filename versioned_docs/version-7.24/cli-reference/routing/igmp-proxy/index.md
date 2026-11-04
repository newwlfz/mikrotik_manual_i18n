---
sidebar_key: "cli-reference/routing/igmp-proxy/index"
sidebar_position: 1
title: "igmp-proxy"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/routing/igmp-proxy
captured_at: '2026-11-01T21:29:32+08:00'
---

-----------

## routing/igmp-proxy 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="quick-leave" typ="bool">Specifies the action on IGMP Leave message. If quick-leave is on, then an IGMP Leave message is sent upstream as soon as a leave message is received from the first client on the downstream interface. Use `yes` only in case there is only one subscriber behind the proxy.</ArgTableRow>
<ArgTableRow arg="query-interval" typ="time">How often to send out IGMP Query messages over downstream interfaces.</ArgTableRow>
<ArgTableRow arg="query-response-interval" typ="time">How long to wait for responses to an IGMP Query message.</ArgTableRow>
</ArgTable>
