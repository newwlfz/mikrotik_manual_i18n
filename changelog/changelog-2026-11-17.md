---
title: "Documentation updates - November 17, 2026"
date: 2026-11-17T00:00:00.000Z
slug: /changelog-2026-11-17
source: https://manual.mikrotik.com/changelog/changelog-2026-11-17
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 17, 2026

November 17, 2026

Summary of documentation changes made on November 17, 2026.

## Firewall & QoS

-   **[Connection tracking](/docs/firewall-and-quality-of-service/connection-tracking)**: Reworked the page around the tasks readers come with. It now covers how to read the connection list and its flags (`S`, `A`, `C`, `F`, `E`, `h`, `s`, `d`, `D`), how to remove connections, the connection states with the usual state-based filter rules, TCP connections that start in the middle (`loose-tcp-tracking`), how long an entry stays and the settings (`enabled=auto` starts tracking when a filter, mangle or NAT rule exists, the per-state timeouts, `max-entries`), and the features that need connection tracking. The FastTrack section has the rule pair, the prerequisites, how to see the fast-tracked connections and the dummy rule counters, and what the fast path bypasses. A connection stops taking the fast path when the rule is removed, and Traffic Flow counts fast-tracked traffic, so it is not in the bypass list.

## CLI Reference

-   **[/ip/firewall/connection/tracking](/docs/cli-reference/ip/firewall/connection/tracking)**: All 23 settings and read-only values are described, with their defaults in the text: `enabled` with its `auto` mode (tracking starts when a filter, NAT or mangle rule needs it), every TCP state timeout, `loose-tcp-tracking` and `liberal-tcp-tracking` (out-of-window segments are accepted with `yes`), the UDP, ICMP and generic timeouts, and `max-entries`, which follows the RAM.
-   **[/ip/firewall/connection](/docs/cli-reference/ip/firewall/connection) and [/ipv6/firewall/connection](/docs/cli-reference/ipv6/firewall/connection)**: All 39 fields of the connection list are described, including what each flag means, which direction `orig` and `repl` count, the reply tuple after NAT, the `tcp-state` values, the ICMP and GRE fields, and the `connection-type` names.
