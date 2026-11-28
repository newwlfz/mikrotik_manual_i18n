---
title: "Documentation updates - November 19, 2026"
date: 2026-11-19T00:00:00.000Z
slug: /changelog-2026-11-19
source: https://manual.mikrotik.com/changelog/changelog-2026-11-19
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - November 19, 2026

November 19, 2026

Summary of documentation changes made on November 19, 2026.

## Bridging & Switching

-   **[VXLAN](/docs/bridging-and-switching/vxlan)**: Reorganized the page around complete static-VTEP, VLAN and multicast configurations, with layered troubleshooting and guidance for FDB learning, BUM replication, VRF underlays, MTU and fragmentation. Examples were run sequentially on lab routers, including untagged and tagged VLAN traffic and IPv4/IPv6 fragmentation cases.
    
-   **[VXLAN](/docs/bridging-and-switching/vxlan) and [L3 Hardware Offloading](/docs/bridging-and-switching/l3-hardware-offloading)**: Corrected dynamic EVPN VTEP coverage, conditional L2MTU behavior and tagged VLAN-aware offload support. Scoped VXLAN-VRF offload to CPSS switch chips and retained the other underlay and overlay restrictions.
    
-   **[MACsec](/docs/bridging-and-switching/macsec)**: Added direct and three-node encrypted-link examples with manual and automatically generated CAK/CKN, plus key-server election, XPN cipher selection and MTU guidance. Examples were verified with routed, bridged and non-IP discovery traffic.
    
-   **[MACsec](/docs/bridging-and-switching/macsec)**: Added monitoring and troubleshooting for negotiation, asymmetric cipher state, parent-interface errors and SC/SA counters. Clarified software operation, static-only key provisioning, replay-protection scope and hardware-offload limits.
    

## CLI Reference

-   **[MACsec](/docs/cli-reference/interface/macsec/)**: Moved property detail out of the guide and filled all 47 interface, profile, monitor and counter descriptions, including key generation, cipher selection, parent restrictions and counter reset.
    
-   **[VXLAN](/docs/cli-reference/interface/vxlan/)**: Moved property tables out of the guide and filled all 39 interface, VTEP, FDB and flag descriptions with defaults, ranges, parameter relationships and loop-protect settings.
