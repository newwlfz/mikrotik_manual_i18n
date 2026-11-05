---
title: "Documentation updates - July 9, 2026"
date: 2026-07-09
slug: /changelog-2026-07-09
source: https://manual.mikrotik.com/changelog/changelog-2026-07-09
captured_at: '2026-11-04T06:08:11+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 9, 2026.

## Bridging & Switching

- **[Bridge IGMP/MLD snooping](/docs/bridging-and-switching/user-guides/bridge-igmp-mld-snooping)**: Added the querier-uses-bridge-address bridge setting (default yes), which makes the bridge IGMP querier use the bridge interface's own IPv4 address as the source for query packets instead of 0.0.0.0. Some multicast clients reject queries from 0.0.0.0, which could interrupt multicast streams when snooping entries time out. It applies only to IPv4 (IGMP) when igmp-snooping and multicast-querier are enabled and the bridge has an IPv4 address; MLD queries always use the bridge's IPv6 link-local address.
