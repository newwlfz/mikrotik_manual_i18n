---
sidebar_key: "virtual-private-networks"
title: "Virtual Private Networks"
description: 'The VPN and tunnel types of RouterOS and when to use each: WireGuard, IPsec, L2TP, SSTP, OpenVPN, PPPoE, GRE, IPIP, EoIP, 6to4, ZeroTier and PPTP.'
tags:
  - 'vpn'
  - 'ipsec'
  - 'openvpn'
source: https://manual.mikrotik.com/docs/virtual-private-networks
captured_at: '2026-11-28T10:14:44.799Z'
---

RouterOS has several ways to connect networks and remote users over another network. Some encrypt the traffic and some only carry it, so choose by what you need:

| You want to | Use |
| :-- | :-- |
| Connect two sites or remote users with strong encryption and little configuration | [WireGuard](/docs/wireguard) |
| Connect to devices and services of other vendors with a standard, encrypted VPN | [IPsec](/docs/virtual-private-networks/ipsec) |
| Give remote users access with a user name and a password, with clients that are built into Windows and other systems | [L2TP](/docs/virtual-private-networks/l2tp) with IPsec, or [SSTP](/docs/virtual-private-networks/sstp) |
| Give remote users access where only web traffic passes the firewalls | [SSTP](/docs/virtual-private-networks/sstp), or [OpenVPN](/docs/virtual-private-networks/openvpn) over TCP |
| Serve or connect OpenVPN clients | [OpenVPN](/docs/virtual-private-networks/openvpn) |
| Connect subscribers on an Ethernet network, or connect to an internet provider | [PPPoE](/docs/virtual-private-networks/pppoe) |
| Carry IP packets between two routers without encryption, or with IPsec added | [GRE](/docs/gre), [IPIP](/docs/ipip) |
| Carry Ethernet frames between two sites | [EoIP](/docs/eoip), or L2TP Ether on the [L2TP](/docs/virtual-private-networks/l2tp) page |
| Carry IPv6 over an IPv4 network | [6to4](/docs/6to4) |
| Join a ZeroTier network | [ZeroTier](/docs/zerotier) |
| Host your own ZeroTier network on a router | [Self-hosted ZeroTier controller](/docs/virtual-private-networks/zerotier-controller) |

[PPTP](/docs/virtual-private-networks/pptp) is an old protocol with weak encryption. Use it only for devices that have nothing else.

The users of the L2TP, SSTP, OpenVPN, PPPoE and PPTP servers are in one database: see [PPP AAA](../authentication-authorization-accounting/ppp-aaa).

<DocCardList />
