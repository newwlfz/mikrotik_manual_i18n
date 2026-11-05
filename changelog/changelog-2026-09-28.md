---
title: "Documentation updates - September 28, 2026"
date: 2026-09-28
slug: /changelog-2026-09-28
source: https://manual.mikrotik.com/changelog/changelog-2026-09-28
captured_at: '2026-11-04T06:08:52+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on September 28, 2026.

## Developer Guides

- **[REST API](/docs/developer-guides/rest-api)**: Rewritten and verified on RouterOS 7.25, with every example run and every output captured again. New sections cover setting up HTTPS with a certificate authority of your own, a least-privilege REST user, restricting access, reading and changing records, running commands, and building a dashboard or integration, including one written by an AI assistant. The page now documents that a REST user needs both the rest-api and the api policy, and that bodies need Content-Type: application/json. It also documents that PATCH works only on records (settings menus use POST .../set), the 60-second limit and how to stay within it, and that one user's requests run one at a time. Other additions: the 10-minute login cache, that the router sends no CORS headers, and a troubleshooting table of status codes and error details. Corrected the old error example (400, not 406), how quoted numbers are parsed, and the reply shape of settings menus. The LTE-only examples were replaced with examples that work on any router: blocking an address for a day, saving the configuration to a server, and a Python traffic reader.

## Firewall & QoS

- **[UPnP](/docs/firewall-and-quality-of-service/upnp)**: Rewritten and verified against RouterOS 7.25. Corrected the allow-disable-external-interface default (it is no), renamed forced-external-ip to forced-ip, removed the outdated step of enabling new interface entries (they are created enabled), and documented that several external interfaces can serve mappings in parallel, each advertised as its own WAN connection device. Added technical details: the service ports (SSDP on UDP 1900, control on TCP 2828 of internal interface addresses), that only permanent mappings are accepted, and that any settings change removes all dynamic port mappings.
- **[NAT-PMP](/docs/firewall-and-quality-of-service/nat-pmp)**: Rewritten following RFC 6886. Corrected the port description (the service listens on UDP 5351, clients listen for the external address announcements on UDP 5350), documented that only one external interface is accepted, and replaced the example output with text (the old port mapping comment could not have come from a NAT-PMP request, which carries no description field).
- **[SSH brute-force protection](/docs/firewall-and-quality-of-service/user-guides/bruteforce-prevention)**: Rewritten with a rule set that works in the default firewall; the old rules were placed after the default drop rule and had no drop rule of their own. Added trusted addresses, unblocking and how many password guesses the rules still allow.
- **[Port knocking](/docs/firewall-and-quality-of-service/user-guides/port-knocking)**: The knock rules now go before the default drop rule, and the broken passphrase (layer 7) example was rebuilt with a working client.
- **[DDoS protection](/docs/firewall-and-quality-of-service/user-guides/ddos-protection)**: Explained how the detection works and where it stops helping. Removed the SYN-ACK rule, which never matched, and the list-creation lines, which left a 0.0.0.0 entry.

## Getting Started

- **[Securing your router](/docs/getting-started/securing-your-router)**: Corrected commands and claims: the sample password contained a non-Latin letter, $ must be escaped in passwords, the WAN firewall example now works with the default configuration, available-from replaces the deprecated address, and the strong-crypto description was wrong.

## High Availability Solutions

- **[MLAG](/docs/high-availability-solutions/multi-chassis-link-aggregation-group)**: Described the values of mlag-state.

## System

- **[Services](/docs/system-information-and-utilities/services)**: The /ip/service and web server property tables moved to the CLI Reference. The page keeps what applies across parameters, including that available-from leaves the port visible, so the firewall is still needed against untrusted networks.

## CLI Reference

- **[/ip/service](/docs/cli-reference/ip/service), [/ip/service/webserver](/docs/cli-reference/ip/service/webserver)**: Filled in all parameter descriptions:

- The TLS versions that tls-version accepts.
- That www-ssl without a certificate offers only anonymous ciphers.
- How available-from refuses clients.
- The invalid flag for a port already in use.
- That each web server part (rest-plain, webfig-secure and the others) answers 403 Forbidden when turned off, and when index-* takes effect.

- **[/user/group](/docs/cli-reference/user/group)**: The policy description now says that set keeps the policies it does not list, so revoke a policy with !.
- **[/ip/upnp](/docs/cli-reference/ip/upnp), [/ip/upnp/interfaces](/docs/cli-reference/ip/upnp/interfaces), [/ip/nat-pmp](/docs/cli-reference/ip/nat-pmp), [/ip/nat-pmp/interfaces](/docs/cli-reference/ip/nat-pmp/interfaces)**: Filled in all parameter descriptions, including defaults, the effect of forced-ip, and the ForceTermination behavior of allow-disable-external-interface.
- **[CLI Reference](/docs/cli-reference)**: Removed parameters that RouterOS no longer has from about 40 command pages, for example in /disk, /system/health and /lcd, and marked deprecated parameters.
