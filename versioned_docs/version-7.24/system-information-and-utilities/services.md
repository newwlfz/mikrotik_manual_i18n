---
sidebar_key: "system-information-and-utilities/services"
sidebar_position: 15
title: "Services"
sidebar_label: 'Services'
description: 'This page documents the IP/Services section in MikroTik RouterOS, detailing default services like Telnet, FTP, SSH, and WinBox along with their configuration properties such as address restrictions, ports, TLS versions, and session limits. It provides examples for managing service access control.'
tags:
  - 'ip-services'
  - 'firewall'
source: https://manual.mikrotik.com/docs/7.24/system-information-and-utilities/services
captured_at: '2026-11-04T11:33:46+08:00'
---

IP/Services lists the protocols and ports used by various MikroTik RouterOS services and containers, including those for incoming connections.

It helps to determine which MikroTik services (or containers) are listening on specific ports, and what needs to be blocked or allowed if you want to restrict or permit access to certain services.

The default services that can be configured from the IP/Services section:

| Property | Description |
| :-- | :-- |
| **telnet** | Telnet service |
| **ftp** | FTP service |
| **www** | WebFig HTTP service |
| **ssh** | SSH service |
| **www-ssl** | WebFig HTTPS service |
| **api** | API service |
| **winbox** | Responsible for WinBox tool access, as well as MikroTik smartphone app and Dude |
| **api-ssl** | API over SSL service |
| **reverse-proxy** | Reverse Proxy service |

## Properties

Note that it is not possible to add new services, only existing service modifications are allowed.

**Sub-menu:** `/ip/service`

| Property | Description |
| :-- | :-- |
| **address** (*IP address/netmask \| IPv6/0..128*; Default: ) | List of IP/IPv6 prefixes from which the service is accessible. When this parameter is set, packets are not dropped at the network level, but access to the service is denied for sources not matching the specified addresses. This option is best suited for restricting access within trusted networks. <br/> To block access from external or untrusted networks, we recommend using a Firewall instead. |
| **certificate** (*name*; Default: **none**) | The name of the certificate used by a particular service. Applicable only for services that depend on certificates (*www-ssl, api-ssl*) |
| **name** (*name*; Default: **none**) | Service name |
| **max-sessions**(*integer: 1..1000*; Default: 20) | Max simultaneous session count for service |
| **port** (*integer: 1..65535*; Default: ) | The port a particular service listens on |
| ***tls-version*** (*any* \| *only-1.2*; Default: **any**) | Specifies which TLS versions to allow by a particular service |
| **vrf** (*name*; Default: **main**) | Specifies which VRF instance to use by a particular service |

### Read-only properties

| Property | Description |
| :-- | :-- |
| **Container** | Name of the container listening on the port |
| **Local** | Router local address used for the connection |
| **Remote** | Remote address that established the connection to the service |

### Example

For example, allow API only from a specific IP/IPv6 address range

```ros
[admin@dzeltenais_burkaans] /ip/service/set api address=10.5.101.0/24,2001:db8:fade::/64
[admin@dzeltenais_burkaans] /ip/service/print where !dynamic      
Flags: X - DISABLED, I - INVALID
Columns: NAME, PORT, PROTO, ADDRESS, CERTIFICATE, VRF, MAX-SESSIONS
 #   NAME     PORT  PROTO  ADDRESS             CERTIFICATE  VRF   MAX-SESSIONS
 0   ftp        21  tcp                                     main            20
 1   ssh        22  tcp                                     main            20
 2   telnet     23  tcp                                     main            20
 7   www        80  tcp                                     main            20
 9 X www-ssl   443  tcp                        none         main            20
13   winbox   8291  tcp                                     main            20
15   api      8728  tcp    10.5.101.0/24                    main            20
                           2001:db8:fade::/64                                 
16   api-ssl  8729  tcp                        none         main            20
```

Example that shows dynamic services that listen or have established connections to router services

```routeros
[admin@dzeltenais_burkaans] /ip/service/print where dynamic  
Flags: D - DYNAMIC; c - CONNECTION
Columns: NAME, NETNS, CONTAINER, PORT, PROTO, LOCAL, REMOTE
 #    NAME        NETNS  CONTAINER  PORT  PROTO  LOCAL         REMOTE            
 3 D  resolver                        53  tcp                                    
 4 D  resolver                        53  udp                                    
 5 D  dhcp                            67  udp                                    
 6 D  dhcpclient                      68  udp                                    
 8 D  snmp                           161  udp                                    
10 D  btest                         2000  tcp                                    
11 D  loader                        3986  tcp                                    
12 D  discover                      5678  udp                                    
14 Dc winbox                        8291  tcp    10.155.221.4  10.145.221.15:51595
17 D  pihole-FTL     16  Pi-hole      53  tcp                                    
18 D  pihole-FTL     16  Pi-hole      53  udp                                    
19 D  lighttpd       16  Pi-hole      80  tcp                                    
28 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52298
29 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52333
30 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52339
31 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52340
32 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52341
33 Dc lighttpd       16  Pi-hole      80  tcp    172.55.1.2    10.145.221.15:52342
26 D  pihole-FTL     16  Pi-hole    4711  tcp
```

## Protocols and ports

The table below shows the list of protocols and ports used by RouterOS.

| Proto/Port | Description |
| :-- | :-- |
| <strong>20/tcp</strong> | FTP data connection |
| <strong>21/tcp</strong> | FTP control connection |
| <strong>22/tcp</strong> | Secure Shell (SSH) remote login protocol |
| <strong>23/tcp</strong> | Telnet protocol |
| <strong>53/tcp 53/udp</strong> | DNS |
| <strong>67/udp</strong> | Bootstrap protocol or <a href="/docs/7.24/network-management/dhcp#dhcp-server">DHCP Server</a> |
| <strong>68/udp</strong> | Bootstrap protocol or <a href="/docs/7.24/network-management/dhcp#dhcp-client">DHCP Client</a> |
| <strong>80/tcp</strong> | World Wide Web HTTP |
| <strong>123/udp</strong> | Network Time Protocol (<a href="/docs/7.24/system-information-and-utilities/ntp">NTP</a> |
| <strong>161/udp</strong> | Simple Network Management Protocol (<a href="/docs/7.24/diagnostics-monitoring-and-troubleshooting/snmp">SNMP</a> |
| <strong>179/tcp</strong> | Border Gateway Protocol (<a href="/docs/7.24/user-guides/routing-and-networking-protocols/unicast/bgp/">BGP</a> |
| <strong>443/tcp</strong> | Secure Socket Layer (SSL) encrypted HTTP |
| <strong>500/udp</strong> | Internet Key Exchange (IKE) protocol |
| <strong>520/udp 521/udp</strong> | <a href="/docs/7.24/user-guides/routing-and-networking-protocols/unicast/rip">RIP</a> routing protocol |
| <strong>546/udp</strong> | <a href="/docs/7.24/network-management/dhcp">DHCPv6 Client</a> message |
| <strong>547/udp</strong> | <a href="/docs/7.24/network-management/dhcp">DHCPv6 Server</a> message |
| <strong>646/tcp</strong> | <a href="/docs/7.24/user-guides/routing-and-networking-protocols/mpls/ldp">LDP</a> transport session |
| <strong>646/udp</strong> | <a href="/docs/7.24/user-guides/routing-and-networking-protocols/mpls/ldp">LDP</a> hello protocol |
| <strong>1080/tcp</strong> | <a href="/docs/7.24/network-management/socks/">SOCKS</a> proxy protocol |
| <strong>1698/udp 1699/udp</strong> | RSVP TE Tunnels |
| <strong>1701/udp</strong> | Layer 2 Tunnel Protocol (<a href="/docs/7.24/virtual-private-networks/l2tp/">L2TP</a>) |
| <strong>1723/tcp</strong> | Point-To-Point Tunneling Protocol (<a href="/docs/7.24/virtual-private-networks/pptp">PPTP</a>) |
| <strong>1900/udp 2828/tcp</strong> | Universal Plug and Play (<a href="/docs/7.24/firewall-and-quality-of-service/upnp">uPnP</a>) |
| <strong>1966/udp</strong> | MME originator message traffic |
| <strong>1966/tcp</strong> | MME gateway protocol |
| <strong>2000/tcp</strong> | Bandwidth test server |
| <strong>5246,5247/udp</strong> | <a href="/docs/7.24/wireless/abgn/capsman/ap-controller-capsman">CAPsMAN</a> |
| <strong>5350/udp</strong> | NAT-PMP client |
| <strong>5351/udp</strong> | NAT-PMP server |
| <strong>5678/udp</strong> | Mikrotik Neighbor Discovery Protocol |
| <strong>6343/tcp</strong> | Default OpenFlow port |
| <strong>8080/tcp</strong> | HTTP Web Proxy |
| <strong>8291/tcp</strong> | <a href="/docs/7.24/management-tools/winbox">Winbox</a> |
| <strong>8728/tcp</strong> | <a href="/docs/7.24/developer-guides/api/">API</a> |
| <strong>8729/tcp</strong> | API-SSL |
| <strong>20561/udp</strong> | MAC winbox |
| <strong>/1</strong> | ICMP |
| <strong>/2</strong> | [Multicast |
| <strong>/4</strong> | <a href="/docs/7.24/virtual-private-networks/ipip">IPIP</a> encapsulation |
| <strong>/41</strong> | IPv6 (encapsulation) |
| <strong>/46</strong> | RSVP TE tunnels |
| <strong>/47</strong> | General Routing Encapsulation (GRE) - used for PPTP and <a href="/docs/7.24/virtual-private-networks/eoip">EoIP</a> tunnels |
| <strong>/50</strong> | Encapsulating Security Payload for IPv4 (ESP) |
| <strong>/51</strong> | Authentication Header for IPv4 (AH) |
| <strong>/89</strong> | <a href="/docs/7.24/user-guides/routing-and-networking-protocols/unicast/ospf/">OSPF</a> routing protocol |
| <strong>/103</strong> | [Multicast |
| <strong>/112</strong> | <a href="/docs/7.24/high-availability-solutions/vrrp">VRRP</a> |

## Web server

The table below shows the list of properties that can be enabled/disabled for web services. All of properties are enabled by default and can be disabled if desired.

In this table "plain" refers to HTTP connections and "secure" to HTTPS connections.

| Property | Description |
| :-- | :-- |
| index-plain: (Default: **yes**) | Home page/login page (Can be disabled when webfig-plain and graphs-plain are disabled) |
| webfig-plain: (Default: **yes**) | WebFig interface |
| graphs-plain: (Default: **yes**) | Graph page |
| rest-plain: (Default: **yes**) | REST API support |
| crl-plain: (Default: **yes**) | CRL(Certificate Revocation List) |
| scep-plain: (Default: **yes**) | SCEP(Simple Certificate Enrollment Protocol) |
| acme-plain: (Default: **yes**) | ACME Challenge |
| index-secure: (Default: **yes**) | Home page/login page (Can be disabled when webfig-secure and graphs-secure are disabled) |
| webfig-secure: (Default: **yes**) | WebFig interface |
| graphs-secure: (Default: **yes**) | Graph page |
| rest-secure: (Default: **yes**) | REST API support |
