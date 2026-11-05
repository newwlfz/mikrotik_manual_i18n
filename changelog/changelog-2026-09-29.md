---
title: "Documentation updates - September 29, 2026"
date: 2026-09-29
slug: /changelog-2026-09-29
source: https://manual.mikrotik.com/changelog/changelog-2026-09-29
captured_at: '2026-11-04T06:08:54+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on September 29, 2026.

## System

-

**[Clock](/docs/system-information-and-utilities/clock)**: Rewritten and verified on RouterOS 7.26. The page now covers the time sources (NTP client, MikroTik cloud with update-time, GPS, manual), named and detected time zones, and manual daylight saving. It adds a troubleshooting list for the 1970 date, a wrongly detected zone, and a clock that is an hour off after a reboot or after setting the date. Corrected: a zone set by hand while time-zone-autodetect is on is replaced after the next startup, not at once, and an omitted date or time part of dst-start/dst-end is reset rather than kept. Also corrected: set the date and the time in separate commands, and the latest accepted date is 2038-01-19 03:14:07 UTC, with later dates ignored.

-

**[Fetch](/docs/system-information-and-utilities/fetch)**: Rewritten with every example tested between two routers and against a server that logged each request:

- FTP and SFTP download and upload, the URL form, and TFTP from /ip/tftp.
- Certificate checking with check-certificate=yes (off by default), including host names, the builtin trust store and the clock.
- New tasks: upload a backup over SFTP, download and import a script safely, and send a JSON webhook notification.
- Corrected: redirect counting (two redirects by default), the size limits of output=user (64512 bytes) and user-with-headers (20480 bytes), and the old 4 KB file limit (files up to 60000 bytes work).
- The script examples now handle a trailing newline and failed requests.

-

**[TFTP](/docs/system-information-and-utilities/tftp)**: Rewritten around tasks, with every example run against a TFTP client: serve a folder, one file for every request, two names for one file, accept uploads, and refuse requests. New: a troubleshooting list with the client error codes and the tftp log topic, how rules match (regular expressions, anchors, \$ in the console), and technical details on block sizes, pipelining and files beyond 65535 blocks. Corrected: read-only defaults to yes, ip-addresses is optional, the server starts with the first rule, and the old (aaa.bin)|(bbb.bin) example matched far more names than intended. A warning explains how to write rules that match only the names you serve.

-

**[Services](/docs/system-information-and-utilities/services)**: The API example now uses available-from instead of the deprecated address, with output captured on RouterOS 7.26.

## Firewall & QoS

- **[DDoS protection](/docs/firewall-and-quality-of-service/user-guides/ddos-protection)**: Tested with a second router as attacker and server. The detection works in the forward chain of a default configuration. For port-forwarded services, however, the raw drop rule never matched, because it sees the router's public address before destination NAT. The page now adds a forward-chain rule that drops the detected pairs after NAT, and shows its counter in the check commands.

## Diagnostics & Monitoring

- **[Packet Sniffer](/docs/diagnostics-monitoring-and-troubleshooting/packet-sniffer)**: Rewritten around capturing to a file for Wireshark, watching packets live, reading a capture in the console and streaming to Wireshark over TZSP, with outputs captured on RouterOS 7.26. Tested and now explained: filters given to start or quick replace the saved filters for that run, different filters always combine, memory-scroll keeps the latest or the first packets, the sniffer turns off fast path and FastTrack while it runs, NAT and VLAN tags as the sniffer sees them, and filter-stream=yes also hides ICMP with the streaming server. Corrected: filter-stream defaults to no, and the old page's file size warning named the wrong parameter.
- **[Graphing](/docs/diagnostics-monitoring-and-troubleshooting/graphing)**: Rewritten with tasks for interface and resource graphs, per-customer queue graphs and PPPoE users, tested with a PC, a second router and a PPPoE session. New: the graphs need no login, who can see which graph, how allow-target exposes queues with a subnet or interface target (including every dynamic PPP queue), how to keep WebFig hidden from customers, what In and Out mean for interfaces and queues, and what store-on-disk keeps across a reboot. Removed: the WebFig menu item for graphs, which no longer exists.

## Developer Guides

- **[REST API](/docs/developer-guides/rest-api)**: The router-to-router /tool/fetch example now names the error shown when the calling router has not imported the CA certificate (no trusted CA certificate found).

## CLI Reference

- **[/system/clock](/docs/cli-reference/system/clock), [/system/clock/manual](/docs/cli-reference/system/clock/manual)**: All descriptions corrected: automatic detection at startup and when re-enabled, the date limits, that get gmt-offset returns seconds, and how omitted parts of dst-start and dst-end are reset.
- **[/tool/fetch](/docs/cli-reference/tool/fetch)**: All 35 rows checked against the requests fetch sends:

- The header-field syntax, and the default content type of POST data.
- Basic authentication, and FTP's anonymous login.
- Compression, the default port of each mode, and the default file name.
- check-certificate values and errors.
- Result limits, and KiB rounding of downloaded and total.

- **[/ip/tftp](/docs/cli-reference/ip/tftp/), [/ip/tftp/settings](/docs/cli-reference/ip/tftp/settings)**: All rows described from lab tests, including how req-filename matches, what real-filename serves, the read-only default, rollover beyond 65535 blocks and the accepted block sizes.
- **[/tool/sniffer](/docs/cli-reference/tool/sniffer/)**: All nine menus described (settings, start, stop, save, quick and the packet, protocol, host and connection views). The IP and MAC protocol lists are complete again, with EtherType numbers read back from the router.
- **[/tool/graphing](/docs/cli-reference/tool/graphing/)**: The settings and the interface, queue and resource rules are fully described, with defaults, access rules and the In/Out direction of each graph.
