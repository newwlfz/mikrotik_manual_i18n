---
sidebar_key: "cli-reference/tool/ping"
sidebar_position: 14
title: "ping"
source: https://manual.mikrotik.com/docs/7.24/cli-reference/tool/ping
captured_at: '2026-11-01T21:30:19+08:00'
---

-----------

## tool/ping 
**Type:** Command

See [Ping](/docs/7.24/diagnostics-monitoring-and-troubleshooting/ping) for the full documentation.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="address (flags=46v%Dm)">IP address or DNS name of the target host. See [address flags](/docs/7.24/cli-reference/#address-flags)</ArgTableRow>
<ArgTableRow arg="interval" typ="time">Time interval between ICMP echo requests</ArgTableRow>
<ArgTableRow arg="size" typ="num">Size of the ICMP data payload in bytes</ArgTableRow>
<ArgTableRow arg="ttl" typ="num">Time to Live value for the ICMP packet</ArgTableRow>
<ArgTableRow arg="dscp" typ="num">DSCP value to set in the IP header for QoS marking</ArgTableRow>
<ArgTableRow arg="do-not-fragment" typ="switch">Set the Don't Fragment flag in the IP header</ArgTableRow>
<ArgTableRow arg="src-address" typ="alt { ip-src-address: ipAddr
, ip6-src-address: ip6Addr
 }">Source IP address to use for the ICMP echo request</ArgTableRow>
<ArgTableRow arg="arp-ping" typ="bool">Use ARP requests instead of ICMP echo to discover hosts</ArgTableRow>
<ArgTableRow arg="count" typ="num">Number of ICMP echo requests to send</ArgTableRow>
<ArgTableRow arg="nd-ping" typ="bool"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum">Interface to send the ping through</ArgTableRow>
<ArgTableRow arg="vrf" typ="enum">VRF table to use for routing the ping request</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="seq" typ="num">Sequence number of the ping response</ArgTableRow>
<ArgTableRow arg="host" typ="alt { ipv6-address: ip6Addr
, mac-address: macAddr
, ip-address: ipAddr
 }">IP or MAC address of the responding host</ArgTableRow>
<ArgTableRow arg="size" typ="num">Size of the received ICMP packet in bytes</ArgTableRow>
<ArgTableRow arg="ttl" typ="num">Time to Live value from the received packet</ArgTableRow>
<ArgTableRow arg="time" typ="time">Round-trip time of the ping probe</ArgTableRow>
<ArgTableRow arg="status" typ="string">Status of the ping response</ArgTableRow>
<ArgTableRow arg="sent" typ="num">Total number of ICMP echo requests sent</ArgTableRow>
<ArgTableRow arg="received" typ="num">Total number of ICMP echo replies received</ArgTableRow>
<ArgTableRow arg="packet-loss" typ="num">Percentage of lost packets</ArgTableRow>
<ArgTableRow arg="min-rtt" typ="time">Minimum measured round-trip time</ArgTableRow>
<ArgTableRow arg="avg-rtt" typ="time">Average measured round-trip time</ArgTableRow>
<ArgTableRow arg="max-rtt" typ="time">Maximum measured round-trip time</ArgTableRow>
</ArgTable>
