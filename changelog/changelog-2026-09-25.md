---
title: "Documentation updates - September 25, 2026"
date: 2026-09-25
slug: /changelog-2026-09-25
source: https://manual.mikrotik.com/changelog/changelog-2026-09-25
captured_at: '2026-11-04T06:08:51+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on September 25, 2026.

## Authentication & AAA

- **[User](/docs/authentication-authorization-accounting/user)**: Reworked the page end to end: step-by-step examples now come first (creating a group and a user, password change and expiry, SSH key import, RADIUS login with User Manager), and the property tables moved to the CLI reference. Corrected several outdated facts after lab verification: the key-owner SSH key parameter became info, sessions are closed with /user/active/remove (request-logout is removed), your own password is changed with /password, and user name character rules are documented accurately. Added verified details on password rules (any characters, blank passwords), inactivity logout/lockscreen behaviour, SSH key file formats, the Mikrotik-Group RADIUS attribute, exclude-groups protection, and RADIUS accounting (Start/Stop and interim updates).

## Bridging & Switching

- **[L3 Hardware Offloading](/docs/bridging-and-switching/l3-hardware-offloading)**: Documented that devices with Marvell 98DX7xxx switch chips also offload routing between VLAN interfaces created directly on Ethernet switch ports, without a bridge; on all other L3HW devices the VLAN interface still has to be on a hardware-offloaded bridge. Updated the inter-VLAN routing notes, the feature table and the per-port setting name (l3-hw-offloading) to match.

## CLI Reference

- **[/system/ntp](/docs/cli-reference/system/ntp/client/)**: Filled in all descriptions for the NTP menus — client, client servers, server, symmetric keys, monitor-peers fields and reset-freq-drift — with verified defaults and behavior, such as the poll interval ranges (powers of 2, 64 s to 1024 s by default) and the using-local-clock fallback state.
- **[/file](/docs/cli-reference/file/)**: Added menu introductions for /file and its copy, head, read and tail commands, linking back to the guide. Verified details added: the contents property is limited to just under 60 KiB (use /file/read for larger files), read requires chunk-size, head/tail default to 10 lines, copy copies directories recursively, and the S flag and url property describe Back To Home File Share entries.
- **[/user](/docs/cli-reference/user/)**: Filled in the descriptions for all /user menus and commands — users, groups and all 17 policies, settings, active sessions, AAA, expire-password, and SSH public/private keys — including verified defaults, ranges and enum values.
- **[/system/scheduler](/docs/cli-reference/system/scheduler)**: Filled in all descriptions: start-date/start-time defaults, the startup behaviour with and without interval, the days values (unset, always, never, weekdays) and how they combine with interval, run alignment to the start time, the default policy, and when next-run is empty.
- **[/disk](/docs/cli-reference/disk/)**: Filled in the descriptions for the /disk menu and its commands (copy, format, check, repair, monitor-traffic, test, nvme-discover, settings, smart-info, blink), including every flag (block device, mounted, swap, RAID member, SMB/NFS/iSCSI/NVMe-over-TCP sharing, TCG-Opal self-encryption), the copy offsets and progress status, and the check output.
- **[/routing/igmp-proxy/interface](/docs/cli-reference/routing/igmp-proxy/interface), [/routing/pimsm/interface](/docs/cli-reference/routing/pimsm/interface)**: Filled in the IGMP proxy and PIM-SM descriptions: global and per-interface robustness and query timers (per-interface values override the global ones), the querier and traffic counter status fields, the IGMP interface template, DR priority and hello timers, and the join-tracking, designated-router and RP-local flags. Removed an outdated print status example from the IGMP proxy interface page.

## Developer Guides

- **[Scripting](/docs/developer-guides/scripting/#script-permissions)**: Corrected the script permissions section: a scheduler entry that calls a script by name runs it with the entry's policy, like a plain /system script run; only use-script-permissions uses the script's own policy. The example log was refreshed on a current RouterOS version.

## Getting Started

- **[Securing your router](/docs/getting-started/securing-your-router)**: Added a "User accounts and groups" step: one account per administrator, custom least-privilege groups (the built-in read group can reboot the router and see sensitive configuration), and SSH key login, which disables SSH password authentication for that user.

## Hardware

- **[Disks](/docs/hardware/disks/)**: Reorganized the page into task sections: how disks are detected (slot names and the B/E/M flags), formatting with all file system choices including discard and wipe, mount points and mount-point-template, partitions, swap space (up to 10 times the RAM, for containers), RAM-backed folders, image mounting, log and web proxy cache on a disk, check and repair, performance tests, monitor-traffic, eject, scan and trim (not supported on USB drives), and S.M.A.R.T. The property, flag and settings tables moved to the CLI reference, and most examples now show output from a current RouterOS version.
- **[S.M.A.R.T. info](/docs/hardware/disks/smart)**: Rewrote the page around reading /disk/smart-info: which values matter for drive health, that the output is the same as smartctl reports on Linux, and that some USB enclosures cannot pass S.M.A.R.T. data through.

## High Availability Solutions

- **[Multi-chassis Link Aggregation Group](/docs/high-availability-solutions/multi-chassis-link-aggregation-group)**: Removed the outdated note that MLAG is not compatible with MVRP.

## Network Management

- **[Web Proxy](/docs/network-management/proxy/web-proxy)**: Added an example showing that setting cache-path to a path that does not exist creates the directories automatically, and that the cache then appears as a web-proxy store in /file.

## System

- **[NTP](/docs/system-information-and-utilities/ntp)**: Rewrote the page around verified RouterOS v7 behavior: client and server examples with real output, the stopped/waiting/synchronized/using-local-clock status meanings, DHCP-supplied dynamic servers, FQDN resolution to resolved-address, symmetric key authentication (crypto NAK on key mismatch), and monitor-peers output explained. Replaced the RouterOS v6 SNTP log section with the current ntp topic messages.
- **[Files](/docs/system-information-and-utilities/files)**: Reworked the page after lab verification. Corrected the /file/read description (it returns a string in data, not an array), documented the real contents size limit, the 10-line default of head/tail, and that directory copies are recursive. All examples refreshed with output from a current RouterOS version, and the page now links to the File Share and Rsync guides for the related /file properties and menus.
- **[Scheduler](/docs/system-information-and-utilities/scheduler)**: Rewrote the page around verified RouterOS v7 behavior. Corrected several statements: days is unset by default (not always, which restarts at start-time every day), entries due at the same time run in no fixed order, startup entries run before interfaces and DHCP are up, and days does not support intervals of a day or longer. Added an explanation of how runs are calculated and how permissions apply, and replaced the log-writing demos with practical examples: nightly backup and export, LEDs off at night, an email after each reboot, guest Wi-Fi during business hours, a weekly backup by email, notifications about new RouterOS versions, a weekly random guest Wi-Fi password, and guest bandwidth limits by time of day.

## User Guides

- **[IGMP Proxy](/docs/user-guides/routing-and-networking-protocols/multicast/igmp-proxy)**: Updated the /routing/igmp-proxy/interface/print output to the current RouterOS format, with the upstream, robustness and query timer columns.
