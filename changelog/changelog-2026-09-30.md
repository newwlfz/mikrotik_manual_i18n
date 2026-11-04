---
title: "Documentation updates - September 30, 2026"
date: 2026-09-30
slug: /changelog-2026-09-30
source: https://manual.mikrotik.com/changelog/changelog-2026-09-30
captured_at: '2026-11-04T06:08:53+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on September 30, 2026.

## Diagnostics & Monitoring

- **[Ping](/docs/7.24/diagnostics-monitoring-and-troubleshooting/ping)**: Rewritten around the tasks readers have, with every output captured on RouterOS 7.26 through a three-hop test network:

- Check the internet by address and by name; a name that does not resolve fails with resolve failed.
- A table of the status values (timeout, net unreachable, host unreachable, admin prohibited, TTL exceeded, no route to host, the two Don't Fragment statuses and echo reply) and what each one means.
- Find the path MTU with do-not-fragment: which router answers, why larger pings then fail at once, and the fix with MSS clamping.
- Ping from a LAN address to test an IPsec tunnel, from a VRF, and through a policy-routing table with src-address and a routing rule.
- Reach hosts that drop ICMP with ARP ping and ND ping, discover IPv6 hosts with ff02::1, ping a MAC address, and use ping in a script.
- Corrected: size is the whole IP packet including the header (so size=1500 matches ping -l 1472 on Windows), a reply later than interval counts as a timeout, and WinBox 4 and WebFig resolve names with the router's DNS (only WinBox 3 uses the computer's).

- **[Traceroute](/docs/7.24/diagnostics-monitoring-and-troubleshooting/traceroute)**: Rewritten from a two-hop example into a guide to reading a trace. It explains the columns and how RouterOS traces (ICMP probes, up to 30 hops, repeated rounds with per-hop statistics). New troubleshooting cases, each with a captured output: hops that stop answering, a router that rejects the traffic (network unreachable, host unreachable and packet filtered in the status column), a routing loop, loss at one hop that is not path loss, and rising round-trip times. Also new: host names with use-dns, finding the hop with the smaller MTU with do-not-fragment, and tracing from a VRF or a chosen source address.
- **[Torch](/docs/7.24/diagnostics-monitoring-and-troubleshooting/torch)**: Rewritten with what the output means, tested with traffic of known size and rate on RouterOS 7.26. Each row is a flow. SRC-ADDRESS is always the far side of the watched interface, so on a LAN bridge TX is what a host downloads and RX what it uploads. New tasks with captured outputs: find the host that uses the bandwidth, watch one protocol or port, check VLAN tags and DSCP marking (a flow marked in one direction only shows as two rows), see traffic that the firewall drops, and see which CPU handles a flow. Corrected: port takes one port (the old port=80,443 example fails), and IP fast path and FastTrack are off while Torch runs.
- **[IP Scan](/docs/7.24/diagnostics-monitoring-and-troubleshooting/ip-scan)**: Rewritten around tasks, with outputs captured on RouterOS 7.26: find the devices on the LAN, check that an address is free, find a device with an unknown static address by listening on an interface (then reach it with a temporary address), and scan a remote network. New: what a scan sends (ARP, ping, an SNMP query for the system name, a NetBIOS query, a reverse DNS lookup, and one BOOTP request). Corrected: setting both interface and address-range scans the range, so the old warning about inconclusive results was removed.
- **[Flood Ping](/docs/7.24/diagnostics-monitoring-and-troubleshooting/flood-ping)**: Rewritten around a packet loss test. New: flood ping needs the traffic-gen device-mode feature (the command fails with not allowed by device-mode otherwise) and how to enable it, and the parameter limits read from the router (up to 1000 requests per run, size 10 to 1500). Removed an unverifiable claim about the send rate and an old output.
- **[Graphing](/docs/7.24/diagnostics-monitoring-and-troubleshooting/graphing)**: Added WinBox steps with screenshots for the interface, resource and queue rules and the graphing settings, and replaced the legacy WinBox graph screenshot with a native one.

## System

- **[Services](/docs/7.24/system-information-and-utilities/services)**: Rewritten around what the router listens on: the dynamic entries in /ip/service and what they mean for the firewall, available-from for several services at once (a list with only IPv4 prefixes refuses IPv6 clients), and management services in a VRF. The protocols and ports list is now three tables (TCP, UDP, IP protocols), checked against the listeners each feature opens:

- Removed ports RouterOS 7 does not use: MME and RSVP over UDP.
- Corrected: OpenFlow connects to its controller and does not listen, and TCP port 20 is not a listening port.
- Added: TFTP, OpenVPN, RADIUS incoming, IPsec NAT traversal, CAPsMAN for WiFi, WireGuard and ICMPv6.
- A note explains that the IP firewall does not stop MAC Telnet, MAC WinBox and MAC ping, and that allowed-interface-list in /tool/mac-server does.

- **[Wake on LAN](/docs/7.24/system-information-and-utilities/wake-on-lan)**: Rewritten with tasks, each tested: wake a computer on the LAN, from outside the network over a VPN, at a set time, and a group of office computers on working days with a script. Explained: with interface, RouterOS sends the magic packet as an Ethernet frame on that interface; without it, as a UDP broadcast through the default route, usually the internet connection, so always give the LAN interface.
- **[Note](/docs/7.24/system-information-and-utilities/note)**: Rewritten with where the note shows, each tested: after the banner on interactive SSH, Telnet and MAC Telnet logins, and with show-at-cli-login also before the Telnet login prompt, where anyone who connects can read it (new warning). Corrected: a sys-note.txt file sets the note only at the next startup.
- **[Identity](/docs/7.24/system-information-and-utilities/identity)**: Where the name appears (prompt, neighbor discovery, SNMP system name, DHCP host name), the 64-character limit, and a corrected SNMP example: setting the name needs a community with write access, because public can only read. New warnings on what a write community allows.
- **[Clock](/docs/7.24/system-information-and-utilities/clock), [Device mode](/docs/7.24/system-information-and-utilities/device-mode), [E-mail](/docs/7.24/system-information-and-utilities/e-mail), [Fetch](/docs/7.24/system-information-and-utilities/fetch), [Files](/docs/7.24/system-information-and-utilities/files), [Identity](/docs/7.24/system-information-and-utilities/identity), [IP packing](/docs/7.24/system-information-and-utilities/ip-packing), [Neighbor discovery](/docs/7.24/system-information-and-utilities/neighbor-discovery), [Note](/docs/7.24/system-information-and-utilities/note), [NTP](/docs/7.24/system-information-and-utilities/ntp), [Partitions](/docs/7.24/system-information-and-utilities/partitions), [Scheduler](/docs/7.24/system-information-and-utilities/scheduler), [Services](/docs/7.24/system-information-and-utilities/services), [TFTP](/docs/7.24/system-information-and-utilities/tftp), [Wake on LAN](/docs/7.24/system-information-and-utilities/wake-on-lan)**: Each page now has a short WinBox section with an annotated screenshot of the native WinBox window for the same task.

## Management Tools

- **[MAC server](/docs/7.24/management-tools/mac-server)**: Rewritten around connecting with MAC Telnet (or WinBox by MAC address), finding routers with MAC scan, and allowing MAC access only on trusted interfaces, tested between two routers. New and verified:

- MAC Telnet is not encrypted: commands and output cross the link in clear text, but the password does not.
- The IP firewall does not stop MAC access; allowed-interface-list or a bridge filter rule on one port does.
- Put the bridge in the list, not its ports; none turns access off; open sessions stay open.
- A user's address setting does not apply to MAC logins.
- Corrected: MAC scan lists the devices that send neighbor discovery, whatever their MAC server settings, and turning MAC ping off does not affect ARP ping.

- **[Quick Set](/docs/7.24/management-tools/quick-set)**: Illustrated with annotated WinBox screenshots: the main areas of the Home AP Dual mode, the network name and Wi-Fi password, the internet connection types and the local network settings.

## CLI Reference

- **[/tool/ping](/docs/7.24/cli-reference/tool/ping)**: Every row now has its range and default, checked with packet captures: size as the whole IP packet (28..65535 for IPv4, 48..65535 for IPv6), ttl (255 for IPv4, hop limit 64 for IPv6), interval, dscp, the source address selection, interface, and the status values.
- **[/tool/traceroute](/docs/7.24/cli-reference/tool/traceroute)**: All rows described: the probe type and size, max-hops (30), timeout (1 second), port (33434 for UDP probes), use-dns, vrf, and the status values a hop can report.
- **[/tool/mac-server](/docs/7.24/cli-reference/tool/mac-server), [/tool/mac-telnet](/docs/7.24/cli-reference/tool/mac-telnet), [/tool/mac-scan](/docs/7.24/cli-reference/tool/mac-scan)**: All rows and menu intros described: the allowed interface lists (default all, the default configuration sets LAN), MAC ping, the sessions list, the client's interface, and what MAC scan shows.
- **[/tool/torch](/docs/7.24/cli-reference/tool/torch)**: All 24 rows described: the filters and how they match, one port per port, cpu=any, and the direction and units of tx and rx.
- **[/tool/wol](/docs/7.24/cli-reference/tool/wol), [/tool/ip-scan](/docs/7.24/cli-reference/tool/ip-scan)**: Described the two Wake on LAN packet forms, and every IP scan row with where its columns come from.
- **[/system/note](/docs/7.24/cli-reference/system/note), [/system/identity](/docs/7.24/cli-reference/system/identity), [/tool/flood-ping](/docs/7.24/cli-reference/tool/flood-ping)**: All rows described, including the flood ping limits and its device-mode requirement.

## Hardware

- **[KNOT](/hardware/knot) and the other IoT product pages**: Each page now has an A4 PDF version, linked under the page title.
