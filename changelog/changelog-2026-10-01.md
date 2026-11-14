---
title: "Documentation updates - October 1, 2026"
date: 2026-10-01
slug: /changelog-2026-10-01
source: https://manual.mikrotik.com/changelog/changelog-2026-10-01
captured_at: '2026-11-04T06:08:54+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 1, 2026.

## Getting Started

- **[Supout.rif](/docs/getting-started/supout-rif)**: Rewritten. Corrected: the file is text with encoded sections, not a binary file. New: what the file holds and when to create it, writing it into a folder, creating it at a set time with the scheduler, downloading it with Files or scp, the automatic autosupout.rif after a crash, and the file format. The screenshots are now in the right WinBox and WebFig sections, with alt text. [Try before RMA](/docs/hardware/try-before-rma) now links here instead of the Resource page.

## Storage

-

**[Tmpfs](/docs/storage/tmpfs)**: Rewritten and tested on RouterOS 7.26. Corrected: tmpfs is part of the base RouterOS package and needs no Storage package (not on SMIPS devices). New sections:

- Create a RAM folder, and what the sizes mean: decimal units, a maximum rather than reserved RAM, about half of the RAM when tmpfs-max-size is not set, and the total size check.
- Check what the folder shares: on routers whose default configuration turns on automatic disk sharing (for example the hAP ax²), a new folder is shared through SMB to the guest user, who needs no password, and through DLNA. How to check it, and how to create the folder unshared or stop the sharing.
- Keep packet captures in RAM and download them, check how full the folder is (a full folder makes writes fail), resize it and delete it.
- Technical details: after a reboot the folder is mounted again empty, and a tmpfs cannot be formatted (use a Ramdisk for a block device).
- The "RAM-backed folder" section of [Disks](/docs/hardware/disks/) now links here.

-

**[DLNA Media Server](/docs/storage/dlna)**: Rewritten with tests from a computer and a second router as players:

- Share a USB disk with the TVs on the LAN, and limit a server to one device with allowed-ip or allowed-hostname (the DHCP host name, exact and case-sensitive; only one of the two can be set). A note says that these limits are not access control.
- The dynamic servers that automatic disk sharing creates (the hAP ax² default configuration turns it on). They cannot be edited, so turn off the disk's media sharing before adding limited servers.
- Which files are listed: media files with lower-case extensions only, and an .srt file next to a video becomes its subtitles. A server without path shares the router's whole file list.
- Troubleshooting, and technical details: SSDP discovery, HTTP on TCP port 2828, thumbnails, and why a server answers only on its own interface.

## Firewall & QoS

- **[Address lists](/docs/firewall-and-quality-of-service/firewall/address-lists)**: Rewritten from a single v6-era example into tasks, each imported as written and tested on RouterOS 7.26:

- Block traffic from a list of addresses with a raw rule, for IPv4 and IPv6.
- Allow SSH and WinBox from a dynamic address by its DNS name, with the rule placed before the default drop rule and a warning on what it opens.
- Block hosts that probe a closed port for a day, with a trusted list the rule skips, because a single packet with a forged source address is enough to list it.
- View, remove, export and import entries. file= must come before where, or the export prints to the terminal and writes no file.
- How entries behave: static and dynamic entries and what a reboot keeps, timeouts (up to 35w3d13h13m56s, reset by each new match), how prefixes and ranges are stored, and how DNS names resolve.
- Corrected: a range written in short form such as 203.0.113.1-254 is stored as a DNS name and matches nothing, and IPv6 lists take no ranges.

## Diagnostics & Monitoring

- **[Speed Test](/docs/diagnostics-monitoring-and-troubleshooting/speed-test)**: Rewritten with tests between two routers and against the router's own bandwidth server.

- Prerequisites: the remote router's bandwidth test server, a user whose group has the test and winbox policies, device mode, and firewall rules on both routers. Without a rule on the testing router, its firewall drops the UDP download traffic.
- New section with tested firewall rules for a test over the internet. To limit who can run tests, use the server's allowed-addresses4 and allowed-addresses6: a user's address setting does not limit bandwidth test logins.
- A table explaining the result lines, and the CPU warning explained.
- Troubleshooting for authentication failed, missing throughput or UDP lines, and device mode.
- Technical details: five parts of test-duration each (10 seconds by default, at least 5), 20 pings per second, the TCP connections and the ports used.
- Corrected the old parameter notes. The default connection-count is 20, or the CPU core count of the router that runs the test when it has more than 20 (tested on a 64-core router).

- **[Bandwidth test](/docs/diagnostics-monitoring-and-troubleshooting/bandwidth-test)**: Now links to Speed Test.
- **[Detect Internet](/docs/diagnostics-monitoring-and-troubleshooting/detect-internet)**: Rewritten with the state rules tested on lab links. An interface becomes wan when the router's active route to 8.8.8.8 goes through it, and internet when the route to cloud.mikrotik.com does too and the cloud answers on UDP port 30000. Removed the old rule that DHCP makes an interface WAN, and the warning that it installs DHCP clients and routes, which did not happen on the lab. Verified and kept: the one-hour LAN lock and the return to lan only after a link change. New: a captured example on a default-configured router, the interface lists it fills and why they do not belong in trust rules, a note that it is not a failover health check, troubleshooting and how to turn it off.
- **[Watchdog](/docs/diagnostics-monitoring-and-troubleshooting/watchdog)**: Rewritten after deliberate ping watchdog reboots of a lab router. The router pings the address six times over ping-timeout and reboots when all six fail, and the log then shows System rebooted because of ping watchdog timeout. no-ping-delay is now ping-start-after-boot. New: a real-life example, a warning about repeated reboots, how long to wait after a boot, and the support output settings.
- **[DNS update](/docs/diagnostics-monitoring-and-troubleshooting/dynamic-dns)**: The Dynamic DNS page is now about /tool/dns-update, and points to IP Cloud DDNS and Fetch for the common cases. Tested against a test DNS server: the update goes over TCP port 53, signed with hmac-md5, and replaces the name's A records; name is relative to the zone; the default TTL is one day. New: prerequisites, how to keep a name current, and what each error message means.

## System

- **[IP Packing](/docs/system-information-and-utilities/ip-packing)**: Rewritten. Removed the v6-style discovery commands; prerequisites now explain that neighbor discovery must run on the interface on both routers. New: how to check it with the unpack field of the neighbor list, and the latency it adds. A warning says that TCP connections the router opens over a packed link fail.

## CLI Reference

- **[/disk](/docs/cli-reference/disk/), [/disk/settings](/docs/cli-reference/disk/settings)**: tmpfs-max-size describes the units, the default size, the total size check and live resizing. The automatic sharing rows note that the hAP ax² default configuration turns them on.
- **[/ip/firewall/address-list](/docs/cli-reference/ip/firewall/address-list), [/ipv6/firewall/address-list](/docs/cli-reference/ipv6/firewall/address-list)**: New intros and corrected rows. Only a range that is exactly one prefix is stored as a prefix, an entry with a timeout is dynamic and not saved, and dynamic=yes and DNS names are explained.
- **[/ip/firewall/raw](/docs/cli-reference/ip/firewall/raw/) and the other filter, mangle, raw and NAT tables (IPv4 and IPv6)**: address-list-timeout now covers a time (reset by each new match), none-dynamic (the same as 0s) and none-static.
- **[/system/sup-output](/docs/cli-reference/system/sup-output), [/ip/media](/docs/cli-reference/ip/media/), [/ip/media/settings](/docs/cli-reference/ip/media/settings)**: All rows described, including the media server's defaults, allowed-ip and allowed-hostname, and the thumbnails effect.
- **[/interface/detect-internet](/docs/cli-reference/interface/detect-internet/), [/interface/detect-internet/state](/docs/cli-reference/interface/detect-internet/state), [/system/watchdog](/docs/cli-reference/system/watchdog), [/tool/dns-update](/docs/cli-reference/tool/dns-update), [/ip/packing](/docs/cli-reference/ip/packing)**: All rows described, with defaults and the verified behaviour from the guide pages.
- **[/tool/speed-test](/docs/cli-reference/tool/speed-test)**: All 14 rows described: the ranges and defaults of connection-count and test-duration, the policies the test user needs, the status values and the result lines.
