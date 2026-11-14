---
sidebar_key: "diagnostics-monitoring-and-troubleshooting/packet-sniffer"
sidebar_position: 4
title: "Packet Sniffer"
sidebar_label: 'Packet Sniffer'
description: 'Packet Sniffer is a MikroTik RouterOS tool for capturing and analyzing network packets to diagnose issues or detect security threats. It supports filtering by IP, MAC, port, protocol, and more, with options to save packets in PCAPNG format or stream them to a PC for analysis.'
tags:
  - 'packet-sniffer'
  - 'filtering'
source: https://manual.mikrotik.com/docs/7.24/diagnostics-monitoring-and-troubleshooting/packet-sniffer
captured_at: '2026-11-04T11:28:03+08:00'
---

A packet sniffer is a tool that can capture and analyze packets that are going to, leaving, or going through the router. Packet sniffing is very useful when you diagnose networks or protect against security attacks over networks.

:::warning
Unicast traffic between Wireless clients with client-to-client forwarding enabled will not be visible to the sniffer tool.

**Warning:** Packets that are processed with hardware offloading enabled on the bridge will not be visible (flooded packets like unknown unicast, broadcast, and multicast traffic might be visible).

**Tip:** Sniffer catches packets before they go into the firewall (direction=rx) or after they leave it (direction=tx).
:::

## Packet Sniffer configuration

RouterOS embedded sniffer allows you to capture packets based on various protocols.

In the following example, we will configure the sniffer to match packets going through the ether1 interface:

```ros
[admin@MikroTik] > /tool/sniffer/start interface=ether1           
[admin@MikroTik] > /tool/sniffer/stop                             
[admin@MikroTik] > /tool/sniffer/save file-name=/flash/test.pcap            
MikroTik] > /file/print where name~"test" 
Columns: NAME, TYPE, SIZE, CREATION-TIME
#  NAME        TYPE  SIZE  CREATION-TIME       
9  flash/test.pcap  file  3696  2019-12-04 10:48:16
```

You can download captured packets from a file section. Then you can use a packet analyzer such as [Wireshark](https://www.wireshark.org/) to analyze a file:

![](/img/51eba29d22b6b595.webp)

If you are using packet streaming to a PC and are using Wireshark, to ensure you are only viewing the streamed data, you will need to apply a filter that matches the port the sniffer is using; by default, 37008 is used. In addition, we recommend using `filter-stream=yes`.

![](/img/8c085953276cc99e.png)

:::warning
Please note that sniffed packets will be available for 10 minutes. If you need them permanently, set a "file-name" to save them directly or issue a "save" command as described previously.

**Important:** Starting with RouterOS 7.20, the sniffer tool saves captured packets in PCAPNG format. The [traffic-generator inject-pcap](/docs/7.24/diagnostics-monitoring-and-troubleshooting/traffic-generator) feature supports PCAPNG format starting from RouterOS 7.21.
:::

**Sub-menu:** `/tool/sniffer`

| Property | Description |
| :-- | :-- |
| **file-limit** (*integer 10..4294967295[KiB]*; Default: **1000KiB**) | File size limit. Sniffer will stop when a limit is reached. |
| **file-name** (*string*; Default: ) | Name of the file where sniffed packets will be saved. |
| **filter-cpu** (*integer*; Default: ) | CPU core used as a filter. |
| **filter-ip-address** (*ip/mask[,ip/mask] (max 16 items)*; Default: ) | Up to 16 IP addresses used as a filter. |
| **filter-dst-ip-address** (*ip/mask[,ip/mask] (max 16 items)*; Default: ) | Up to 16 IP destination addresses used as a filter. |
| **filter-src-ip-address** (*ip/mask[,ip/mask] (max 16 items)*; Default: ) | Up to 16 IP source addresses used as a filter. |
| **filter-ipv6-address** (*ipv6/mask[,ipv6/mask] (max 16 items)*; Default: ) | Up to 16 IPv6 addresses used as a filter. |
| **filter-dst-ipv6-address** (*ipv6/mask[,ipv6/mask] (max 16 items)*; Default: ) | Up to 16 IPv6 destination addresses used as a filter. |
| **filter-src-ipv6-address** (*ipv6/mask[,ipv6/mask] (max 16 items)*; Default: ) | Up to 16 IPv6 source addresses used as a filter. |
| **filter-mac-address** (*mac/mask[,mac/mask] (max 16 items)*; Default: ) | Up to 16 MAC addresses and MAC address masks used as a filter. |
| **filter-dst-mac-address** (*mac/mask[,mac/mask] (max 16 items)*; Default: ) | Up to 16 MAC destination addresses and MAC address masks used as a filter. |
| **filter-src-mac-address** (*mac/mask[,mac/mask] (max 16 items)*; Default: ) | Up to 16 MAC source addresses and MAC address masks used as a filter. |
| **filter-port** (*[!]port[,port] (max 16 items)*; Default: ) | Up to 16 comma-separated ports used as a filter. A list of predefined port names is also available, like ssh and telnet. |
| **filter-dst-port** (*[!]port[,port] (max 16 items)*; Default: ) | Up to 16 comma-separated destination ports used as a filter. A list of predefined port names is also available, like ssh and telnet. |
| **filter-src-port** (*[!]port[,port] (max 16 items)*; Default: ) | Up to 16 comma-separated source ports used as a filter. A list of predefined port names is also available, like ssh and telnet. |
| **filter-ip-protocol** (*[!]protocol[,protocol] (max 16 items)*; Default: ) | Up to 16 comma-separated IP/IPv6 protocols used as a filter. IP protocols (instead of protocol names, protocol numbers can be used):<ul><li><strong>ipsec-ah</strong> - IPsec AH protocol</li><li><strong>ipsec-esp</strong> - IPsec ESP protocol</li><li><strong>ddp</strong> - datagram delivery protocol</li><li><strong>egp</strong> - exterior gateway protocol</li><li><strong>ggp</strong> - gateway-gateway protocol</li><li><strong>gre</strong> - general routing encapsulation</li><li><strong>hmp</strong> - host monitoring protocol</li><li><strong>idpr-cmtp</strong> - idpr control message transport</li><li><strong>icmp</strong> - internet control message protocol</li><li><strong>icmpv6</strong> - internet control message protocol v6</li><li><strong>igmp</strong> - internet group management protocol</li><li><strong>ipencap</strong> - ip encapsulated in ip</li><li><strong>ipip</strong> - ip encapsulation</li><li><strong>encap</strong> - ip encapsulation</li><li><strong>iso-tp4</strong> - iso transport protocol class 4</li><li><strong>ospf</strong> - open shortest path first</li><li><strong>pup</strong> - parc universal packet protocol</li><li><strong>pim</strong> - protocol independent multicast</li><li><strong>rspf</strong> - radio shortest path first</li><li><strong>rdp</strong> - reliable datagram protocol</li><li><strong>st</strong> - st datagram mode</li><li><strong>tcp</strong> - transmission control protocol</li><li><strong>udp</strong> - user datagram protocol</li><li><strong>vmtp</strong> - versatile message transport</li><li><strong>vrrp</strong> - virtual router redundancy protocol</li><li><strong>xns-idp</strong> - xerox xns idp</li><li><strong>xtp</strong> - xpress transfer protocol</li></ul> |
| **filter-mac-protocol**(*[!]protocol[,protocol] (max 16 items)*; Default: ) | Up to 16 comma separated entries used as a filter. Mac protocols (instead of protocol names, protocol numbers can be used):<ul><li><strong>802.2</strong> - 802.2 Frames (0x0004)</li><li><strong>arp</strong> - Address Resolution Protocol (0x0806)</li><li><strong>capsman</strong> - CAPsMAN to CAP MAC layer connection (0x88BB)</li><li><strong>dot1x</strong> - EAPoL IEEE 802.1X (0x888E)</li><li><strong>homeplug-av</strong> - HomePlug AV MME (0x88E1)</li><li><strong>ip</strong> - Internet Protocol version 4 (0x0800)</li><li><strong>ipv6</strong> - Internet Protocol Version 6 (0x86DD)</li><li><strong>ipx</strong> - Internetwork Packet Exchange (0x8137)</li><li><strong>lacp</strong> - Link Aggregation Control Protocol (0x8809)</li><li><strong>lldp</strong> - Link Layer Discovery Protocol (0x88CC)</li><li><strong>loop-protect</strong> - Loop Protect Protocol (0x9003)</li><li><strong>macsec</strong> - MAC security IEEE 802.1AE (0x88E5)</li><li><strong>mpls-multicast</strong> - MPLS multicast (0x8848)</li><li><strong>mpls-unicast</strong> - MPLS unicast (0x8847)</li><li><strong>mvrp</strong> - Multiple VLAN Registration protocol (0x88F5)</li><li><strong>packing-compr</strong> - Encapsulated packets with compressed <a href="/docs/7.24/system-information-and-utilities/ip-packing">IP packing</a> (0x9001)</li><li><strong>packing-simple</strong> - Encapsulated packets with simple <a href="/docs/7.24/system-information-and-utilities/ip-packing">IP packing</a> (0x9000)</li><li><strong>pppoe</strong> - PPPoE Session Stage (0x8864)</li><li><strong>pppoe-discovery</strong> - PPPoE Discovery Stage (0x8863)</li><li><strong>rarp</strong> - Reverse Address Resolution Protocol (0x8035)</li><li><strong>romon</strong> - Router Management Overlay Network RoMON (0x88BF)</li><li><strong>service-vlan</strong> - Provider Bridging (IEEE 802.1ad) &amp; Shortest Path Bridging IEEE 802.1aq (0x88A8)</li><li><strong>vlan</strong> - VLAN-tagged frame (IEEE 802.1Q) and Shortest Path Bridging IEEE 802.1aq with NNI compatibility (0x8100)</li></ul> |
| **filter-stream** (*yes \| no*; Default: **yes**) | Sniffed packets that are destined for the sniffer server are ignored. |
| **filter-size** (*integer[-integer]:0..65535*; Default: ) | Filters packets of specified size or size range in bytes. |
| **filter-direction**(*any \| rx \| tx*; Default: ) | Specifies which direction filtering will be applied. |
| **filter-interface** (*all \| name*; Default: **all**) | Interface name on which sniffer will be running. **all** indicates that the sniffer will sniff packets on all interfaces. |
| **filter-operator-between-entries** (*and \| or*; Default: **or**) | Changes the logic for filters with multiple entries. |
| **filter-vlan** (*integer[,integer]:0..4095*; Default: ) | Up to 16 VLAN IDs used as a filter. |
| **memory-limit**(*integer 10..4294967295[KiB]*; Default: **100KiB**) | Memory amount used to store sniffed data. |
| **memory-scroll** (*yes \| no*; Default: **yes**) | Whether to rewrite older sniffed data when the memory limit is reached. |
| **only-headers**(*yes \| no*; Default: **no**) | Save in the memory only the packet's headers, not the whole packet. |
| **show-frame (*yes \| no*; Default: no)** | Whether to see the content of the frame when running quick sniffer in command line. |
| **streaming-enabled** (*yes \| no*; Default: **no**) | Defines whether to send sniffed packets to the streaming server. |
| **streaming-server** (*IP*; Default: **0.0.0.0**) | Tazmen Sniffer Protocol (TZSP) stream receiver. |
| **streaming-port** (*port*; Default: **37008** ) | Port to stream the TZSP packets to. |

:::danger
The `file-size` limit should not be configured to more than available free memory!
:::

### Packet Sniffer Quick Mode

The quick mode will display results as they are filtered out with a limited-size buffer for packets. There are several attributes that can be set up for filtering. If no attributes are set, the current configuration will be used.

```ros
[admin@MikroTik] > /tool/sniffer/quick ip-protocol=icmp
Columns: INTERFace, TIME, NUm, DIr, SRC-MAC, DST-MAC, SRC-ADDRESS, DST-ADDRESS, PROTOCOl, SIze, Cpu, FP
INTERF  TIME    NU  DI  SRC-MAC            DST-MAC            SRC-ADDRESS     DST-ADDRESS     PROTOCO  SI  C  FP
ether7  35.472  79  <-  6C:3B:6B:ED:83:69  6C:3B:6B:ED:81:83  10.155.126.252  10.155.126.253  ip:icmp  70  7  no
ether7  35.472  80  ->  6C:3B:6B:ED:81:83  6C:3B:6B:ED:83:69  10.155.126.253  10.155.126.252  ip:icmp  70  7  no
ether1  35.595  81  <-  6C:3B:6B:ED:83:63  6C:3B:6B:ED:81:7D  172.24.24.2     172.24.24.1     ip:icmp  70  4  no
ether1  35.595  82  ->  6C:3B:6B:ED:81:7D  6C:3B:6B:ED:83:63  172.24.24.1     172.24.24.2     ip:icmp  70  4  no
ether7  36.457  83  <-  6C:3B:6B:ED:83:69  6C:3B:6B:ED:81:83  10.155.126.252  10.155.126.253  ip:icmp  70  7  no
ether7  36.457  84  ->  6C:3B:6B:ED:81:83  6C:3B:6B:ED:83:69  10.155.126.253  10.155.126.252  ip:icmp  70  7  no
ether1  36.6    85  <-  6C:3B:6B:ED:83:63  6C:3B:6B:ED:81:7D  172.24.24.2     172.24.24.1     ip:icmp  70  4  no
ether1  36.6    86  ->  6C:3B:6B:ED:81:7D  6C:3B:6B:ED:83:63  172.24.24.1     172.24.24.2     ip:icmp  70  4  no
```

:::warning
Traffic-Generator packets will not be visible using the packet sniffer on the same interface unless the *fast-path* parameter is set.
:::

### Packet Sniffer Protocols

In this submenu, you can see all sniffed protocols and their share of the whole sniffed amount.

```ros
[admin@MikroTik] /tool/sniffer/protocol> print 
 # PROTOCOL IP-PROTOCOL PORT                                     PACKETS      BYTES        SHARE
 0 802.2                                                              1         60        0.05%
 1 ip                                                               215     100377       99.04%
 2 arp                                                                2        120        0.11%
 3 ipv6                                                               6        788        0.77%
 4 ip       tcp                                                     210      99981       98.65%
 5 ip       udp                                                       3        228        0.22%
 6 ip       ospf                                                      2        168        0.16%
 7 ip       tcp         8291 (winbox)                               210      99981       98.65%
 8 ip       tcp         36771                                       210      99981       98.65%
 9 ip       udp         646                                           3        228        0.22%
```

### Packet Sniffer Host

The submenu shows the list of hosts that were participating in the data exchange you've sniffed.

```ros
[admin@MikroTik] /tool/sniffer/host> print 
 # ADDRESS         RATE                PEEK-RATE           TOTAL            
 0 10.5.101.3      0bps/0bps           0bps/720bps         0/90             
 1 10.5.101.10     0bps/0bps           175.0kbps/19.7kbps  61231/7011       
 2 10.5.101.13     0bps/0bps           0bps/608bps         0/76             
 3 10.5.101.14     0bps/0bps           0bps/976bps         0/212            
 4 10.5.101.15     0bps/0bps           19.7kbps/175.0kbps  7011/61231       
 5 224.0.0.2       0bps/0bps           608bps/0bps         76/0             
 6 224.0.0.5       0bps/0bps           1440bps/0bps        302/0 
```

### Packet Sniffer Connections

Here you can get a list of the connections that have been watched during the sniffing time.

```ros
[admin@MikroTik] /tool/sniffer/connection> print
Flags: A - active
  #   SRC-ADDRESS       DST-ADDRESS             BYTES     RESENDS   MSS
  0 A 10.0.0.241:1839   10.0.0.181:23 (telnet)  6/42      60/0      0/0
  1 A 10.0.0.144:2265   10.0.0.181:22 (ssh)     504/252   504/0     0/0
```
