---
sidebar_key: "cli-reference/interface/vrrp"
sidebar_position: 39
title: "vrrp"
sidebar_label: 'vrrp'
source: https://manual.mikrotik.com/docs/cli-reference/interface/vrrp
captured_at: '2026-11-01T21:27:41+08:00'
---

-----------

## interface/vrrp 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="G" typ="grp-authority">grp-authority</ArgTableRow>
<ArgTableRow arg="g" typ="grp-member">grp-member</ArgTableRow>
<ArgTableRow arg="R" typ="running">running</ArgTableRow>
<ArgTableRow arg="M" typ="master">master</ArgTableRow>
<ArgTableRow arg="B" typ="backup">backup</ArgTableRow>
<ArgTableRow arg="F" typ="failure">failure</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="arp" typ="enum (disabled | enabled | proxy-arp | reply-only | local-proxy-arp) { disabled:0, enabled:1, proxy-arp:2, reply-only:3, local-proxy-arp:4 }"></ArgTableRow>
<ArgTableRow arg="arp-timeout" typ="alt { arp-timeout: enum (auto) { auto:0 }
, arp-timeout: time
 }"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="group-master" typ="iface_enum { :0, none:0, self }">deprecated</ArgTableRow>
<ArgTableRow arg="group-authority" typ="iface_enum { :0, none:0, self }">VRRP interface-authority that controls the entire group</ArgTableRow>
<ArgTableRow arg="vrid" typ="num"></ArgTableRow>
<ArgTableRow arg="priority" typ="num"></ArgTableRow>
<ArgTableRow arg="interval" typ="time"></ArgTableRow>
<ArgTableRow arg="preemption-mode" typ="bool"></ArgTableRow>
<ArgTableRow arg="authentication" typ="enum (none | simple | ah) { none:0, simple:1, ah:2 }"></ArgTableRow>
<ArgTableRow arg="password" typ="string"></ArgTableRow>
<ArgTableRow arg="on-backup" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="on-master" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="on-fail" typ="alt { script: string
 }"></ArgTableRow>
<ArgTableRow arg="version" typ="enum (2 | 3) { 2:2, 3:3 }"></ArgTableRow>
<ArgTableRow arg="v3-protocol" typ="enum (ipv4 | ipv6) { ipv4:1, ipv6:2 }"></ArgTableRow>
<ArgTableRow arg="v3-checksum-as-v2" typ="bool">Controls if pseudoheader checksum is included for v3 ipv4 packets</ArgTableRow>
<ArgTableRow arg="sync-connection-tracking" typ="bool">Connection tracking data exchange between master and backup</ArgTableRow>
<ArgTableRow arg="remote-address" typ="ipAddr">Forces address of the sender or receiver of Conntrack data</ArgTableRow>
<ArgTableRow arg="connection-tracking-mode" typ="enum (passive-active | active-active) { passive-active:0, active-active:1 }"></ArgTableRow>
<ArgTableRow arg="connection-tracking-port" typ="num">Port used for Conntrack data sync</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="mtu" typ="num"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
</ArgTable>
