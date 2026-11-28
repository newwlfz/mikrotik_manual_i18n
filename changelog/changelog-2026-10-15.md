---
title: "Documentation updates - October 15, 2026"
date: 2026-10-15T00:00:00.000Z
slug: /changelog-2026-10-15
source: https://manual.mikrotik.com/changelog/changelog-2026-10-15
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - October 15, 2026

October 15, 2026

Summary of documentation changes made on October 15, 2026.

## System

-   **[SNMP](/docs/diagnostics-monitoring-and-troubleshooting/snmp)**: Full overhaul, tested on RouterOS 7.26beta1 on hAP ax² boards. Turned into a task-oriented guide: enable SNMP for a collector, restrict a community, SNMPv3 security (MD5/SHA1/SHA256/SHA384/SHA512, DES/AES, 8-character minimum passwords), how to find any OID with `print oid`, receive traps (trap version, `trap-interfaces` semantics, `send-trap`), and SNMP write (identity, run scripts, reboot), plus a check-and-troubleshoot section and technical details (engine ID vs. `engine-id-suffix`, reply source address, the MIB set). All examples and outputs are fresh captures; the `denied-oids` per-community blacklist is now documented. The image has alt text, and the old wrong claims were removed (the "script value must not be 0" rule, the `address`/`trap-interfaces` misstatements).
-   **[Device mode](/docs/system-information-and-utilities/device-mode)**: Corrected how a pending update is canceled: `/system/device-mode/update` without parameters cancels it (`canceled previous update`), an `update` with parameters while another one is pending cancels the pending one and is not applied itself, and a regular reboot cancels a pending change instead of confirming it. A request that cancels an update does not count toward `attempt-count`. Version references were replaced with the current behavior (factory modes on new devices, Netinstall and FlashFig setting device-mode during provisioning), and the [`/system/device-mode/update`](/docs/cli-reference/system/device-mode/update) reference matches.

## Management Tools

-   **[CMR](/docs/management-tools/cmr/#upgrade-in-network-order)**: New "Upgrade in network order" section: the server does not derive the upgrade order from the topology, so give devices labels by their place in the network and list the labels in `order` from the edge toward the server (for example `order=ap,switch,gw` with `strategy=sequential` and `fail-policy=stop`), and upgrade the CMR server itself last. Also documented: [`/cmr/device/upgrade`](/docs/cli-reference/cmr/device/upgrade) shows the job's devices until Control+C or the end of `duration` while the job continues on the server; a deleted package directory still shows in `/cmr print` and downloaded packages stay in RAM until the directory is created again; a missing package leaves the device `pending` with **no upgrade available**; and a job that upgrades the server itself ends as `done` with `0/1` and shows the server as `rebooting`, even when the upgrade succeeded.

## CLI Reference

-   **[`/snmp`](/docs/cli-reference/snmp)**, **[`/snmp/community`](/docs/cli-reference/snmp/community)**, **[`/snmp/send-trap`](/docs/cli-reference/snmp/send-trap)**: Menu intros and all parameter descriptions filled in (27 rows), including `engine-id-suffix`, `denied-oids`, the SHA-2 authentication protocols, and the trap-generator options.
-   **[`/tool/snmp-get`](/docs/cli-reference/tool/snmp-get)**, **[`/tool/snmp-walk`](/docs/cli-reference/tool/snmp-walk)**: All argument descriptions filled in (previously empty), including the port, `next` (GETNEXT) and the SNMPv3 parameters.
