---
title: "Documentation updates - October 15, 2026"
date: 2026-10-15
slug: /changelog-2026-10-15
source: https://manual.mikrotik.com/changelog/changelog-2026-10-15
captured_at: '2026-11-04T06:09:03+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 15, 2026.

## System

- **[SNMP](/docs/7.24/diagnostics-monitoring-and-troubleshooting/snmp)**: Full overhaul, tested on RouterOS 7.26beta1 on hAP ax² boards. Turned into a task-oriented guide: enable SNMP for a collector, restrict a community, SNMPv3 security (MD5/SHA1/SHA256/SHA384/SHA512, DES/AES, 8-character minimum passwords), how to find any OID with print oid, receive traps (trap version, trap-interfaces semantics, send-trap), and SNMP write (identity, run scripts, reboot), plus a check-and-troubleshoot section and technical details (engine ID vs. engine-id-suffix, reply source address, the MIB set). All examples and outputs are fresh captures; the denied-oids per-community blacklist is now documented. The image has alt text, and the old wrong claims were removed (the "script value must not be 0" rule, the address/trap-interfaces misstatements).

## CLI Reference

- **[/snmp](/docs/7.24/cli-reference/snmp)**, **[/snmp/community](/docs/7.24/cli-reference/snmp/community)**, **[/snmp/send-trap](/docs/7.24/cli-reference/snmp/send-trap)**: Menu intros and all parameter descriptions filled in (27 rows), including engine-id-suffix, denied-oids, the SHA-2 authentication protocols, and the trap-generator options.
- **[/tool/snmp-get](/docs/7.24/cli-reference/tool/snmp-get)**, **[/tool/snmp-walk](/docs/7.24/cli-reference/tool/snmp-walk)**: All argument descriptions filled in (previously empty), including the port, next (GETNEXT) and the SNMPv3 parameters.
