---
title: "Documentation updates - October 9, 2026"
date: 2026-10-09
slug: /changelog-2026-10-09
source: https://manual.mikrotik.com/changelog/changelog-2026-10-09
captured_at: '2026-11-04T06:09:01+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 9, 2026.

## Diagnostics & Monitoring

- **[Netwatch](/docs/diagnostics-monitoring-and-troubleshooting/netwatch)**: Rewritten and tested on RouterOS 7.26beta1. Every probe type (simple, ICMP, TCP-conn, HTTP-GET, HTTPS-GET, DNS) has its own section with a working example and an explanation of how thresholds decide the verdict — including that thresholds have defaults even when unset, and how early-success-detection and early-failure-detection work with thr-loss-count. The Scripts section covers the probe variables, the internal *sys user and the four allowed script policies.
- **[Neighbor discovery](/docs/system-information-and-utilities/neighbor-discovery)**: Rewritten. New "Choose which interfaces participate" section (discover-interface-list, mode=rx-only, master and slave interface behaviour) and an LLDP-MED Network Policy example that configures a VoIP phone port with a tagged voice VLAN and untagged PC data. LLDP TLVs, aging and SNMP behaviour are documented in Technical details.
- **[Profiler](/docs/diagnostics-monitoring-and-troubleshooting/profiler)**: Rewritten. Documents the cpu=total, cpu=all and single-core views, duration and freeze-frame-interval, what the first frames show, a "Find a busy process" walkthrough, and the full classifier table including system rows and the unclassified fallback.
- **[Health](/docs/diagnostics-monitoring-and-troubleshooting/health)**: Expanded with a full readings table (names, units, numbering), voltage and temperature details, the power supply state table, legacy device notes, fan control behaviour (including the PoE-out load table and manual fan control), and monitoring options: SNMP trap and OIDs, REST API and an email alert example.
- **[Traffic Flow](/docs/diagnostics-monitoring-and-troubleshooting/traffic-flow/)**: Rewritten. Covers enabling the service and choosing interfaces, packet sampling, export targets, the flow counter monitor, IPFIX field selection, a minimal end-to-end example, and notes on what traffic is counted (CPU-routed traffic only, mirrored frames never reach the input chain).
- **[Resource](/docs/diagnostics-monitoring-and-troubleshooting/resource)**: Rewritten. Live monitoring, per-core CPU breakdown, interrupt (IRQ) pinning with an example, Receive Packet Steering and when it pays off, the PCI/USB/SCSI hardware map, and USB device authorization and power reset.
- **[Interface stats and monitor-traffic](/docs/diagnostics-monitoring-and-troubleshooting/interface-stats-and-monitor-traffic)**: Rewritten. The stats and stats-detail counters are explained (including the Fast Path counters, queue drops and link-down counts), along with live per-second rates in monitor-traffic and script triggers with /tool/traffic-monitor.

## Management Tools

- **[RoMON](/docs/management-tools/romon)**: Rewritten. Enable, choose participating ports (wildcard default entry, physical interfaces only), protect the overlay with secrets — including a step-by-step secret rotation that can be performed over RoMON itself — discover routers, RoMON ping, SSH over RoMON and WinBox access. Notes the RB5009 switch-chip limitation and the EtherType and multicast MAC details in Technical details.

## System

- **[Precision Time Protocol](/docs/system-information-and-utilities/precision-time-protocol)**: Rewritten. Configuration (profile and ports, per-profile presets), PTP on VLAN ports (bridge VLAN table requirement and the tagged-trunk alternative), IGMP snooping static MDB entries, synchronization monitoring with /system/ptp/status and /system/ptp/monitor, and the supported devices list.

## Hardware

- **[PoE](/docs/hardware/poe-out)**: Reworked from a PoE-Out page into a general PoE guide covering both PoE out (PSE) and PoE in (PD). New power classes table for 802.3af/at/bt, how to read which passive PoE a device supports from its specification, PoE in configuration and powering requirements, examples for both directions, logging and warnings, and troubleshooting.

## CLI Reference

- **[/tool/netwatch](/docs/cli-reference/tool/netwatch)**, **[/tool/profile](/docs/cli-reference/tool/profile)**, **[/tool/romon](/docs/cli-reference/tool/romon/)**, **[/tool/traffic-monitor](/docs/cli-reference/tool/traffic-monitor)**: Parameter descriptions filled in and corrected: netwatch probe defaults (including the 60s interval of simple probes), VRF and link-local host syntax, and fixed early-detection descriptions; profiler views; RoMON port restrictions and secrets; traffic-monitor trigger units.
- **[/system/health](/docs/cli-reference/system/health/)**, **[/system/ptp](/docs/cli-reference/system/ptp/)**, **[/system/resource](/docs/cli-reference/system/resource/)**, **[/ip/traffic-flow](/docs/cli-reference/ip/traffic-flow/)**, **[/interface](/docs/cli-reference/interface/)**, **[/interface/monitor-traffic](/docs/cli-reference/interface/monitor-traffic)**: Descriptions for the reworked pages: health readings and fan settings, PTP profile presets and ports, resource counters and IRQ/RPS, Traffic Flow and IPFIX fields, and interface counters and rate rows.
