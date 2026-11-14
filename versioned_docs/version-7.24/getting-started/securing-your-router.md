---
sidebar_key: "getting-started/securing-your-router"
sidebar_position: 3
title: "Securing your router"
sidebar_label: 'Securing your router'
description: 'This page provides security recommendations for MikroTik RouterOS, including upgrading RouterOS versions, changing default usernames and passwords, securing access with firewall rules and VPNs, disabling unnecessary services like MAC-Telnet and Neighbor Discovery, and managing DNS caching to enhance router security.'
tags:
  - 'firewall'
  - 'vpn'
  - 'security'
source: https://manual.mikrotik.com/docs/7.24/getting-started/securing-your-router
captured_at: '2026-11-04T11:29:05+08:00'
---

The following steps are recommendations on how to additionally protect your device with already configured [strong firewall rules](/docs/7.24/firewall-and-quality-of-service/firewall/filter).

## RouterOS Version

Start by upgrading your RouterOS version. Some older releases have had certain weaknesses or vulnerabilities that have been fixed. Keep your device up to date to ensure it is secure. Click "Check for Updates" in WinBox or WebFig to upgrade. It is recommended to follow announcements on our [Security Announcements Blog](https://blog.mikrotik.com) to stay informed about any new security issues.

## Access to a router

### Access Username

Change the default username **admin** to a custom name. Using a unique username helps protect access to your router if someone gains direct physical access to the device:

```ros
/user/add name=myname password=mypassword group=full
/user/disable admin
```

### Access password

MikroTik routers require password configuration. We suggest using a password generator tool to create secure and non-repeating passwords. By a secure password, we mean:

- Minimum 12 characters.
- Include numbers, symbols, capital and lowercase letters.
- Is not a dictionary word or a combination of dictionary words.
- Note that quote characters in the password require escaping.

```ros
/user/set myname password="!={Ba3N!40TуX+GvKBz?jTLIUcx/,"
```

### Securing access to the device

A pre-configured firewall blocks WAN (internet-side) connection attempts by default. This is intentional—do not remove these rules unless you are certain the connection is secure.

If you need to open remote access to your device, we recommend using a Virtual Private Network (VPN) such as WireGuard to secure the connection.

A configuration guide for [WireGuard VPN](/docs/7.24/virtual-private-networks/wireguard) is available here.

### Firewall rules for management access

Access to services on the public interface should be restricted using firewall rules, which prevent connections from reaching the service at all. The example below allows only ICMP (ping and traceroute), WinBox, and SSH from the WAN interface, and drops everything else:

```ros
/ip/firewall/filter
add chain=input action=accept connection-state=established,related,untracked comment="accept established,related,untracked"
add chain=input action=drop connection-state=invalid comment="drop invalid"
add chain=input in-interface=ether1 action=accept protocol=icmp comment="accept ICMP"
add chain=input in-interface=ether1 action=accept protocol=tcp dst-port=8291 comment="allow WinBox"
add chain=input in-interface=ether1 action=accept protocol=tcp dst-port=22 comment="allow SSH"
add chain=input in-interface=ether1 action=drop comment="block everything else"
```

:::danger
If the public interface is PPPoE, LTE, or another interface type, `in-interface` should be set accordingly.
:::

You can also limit a specific user account to certain source addresses with the **Allowed Address** property:

```ros
/user/set 0 address=192.168.88.0/24
```

### RouterOS MAC-access

RouterOS includes built-in feature options that provide convenient management access to network devices. However, the following services should be disabled in production networks: **MAC-Telnet, MAC-WinBox,** and **MAC-Ping.**

```ros
/tool/mac-server/set allowed-interface-list=none 
/tool/mac-server/mac-winbox/set allowed-interface-list=none 
/tool/mac-server/ping/set enabled=no
```

### Neighbor Discovery

The MikroTik Neighbor Discovery protocol is used to discover and identify other MikroTik routers on the network. To disable Neighbor Discovery on all interfaces, use the following command:

```ros
/ip/neighbor/discovery-settings/set discover-interface-list=none
```

### Bandwidth server

The bandwidth server is used to test throughput between two MikroTik routers. Disable it in the production environment:

```ros
/tool/bandwidth-server/set enabled=no 
```

### DNS Cache

DNS cache improves performance by storing resolved DNS query results locally on the router, reducing the time needed to resolve DNS requests from client devices to remote servers. If DNS caching is not required on your router—for example, if another device on your network handles DNS caching—you should disable this feature to improve security:

```ros
/ip/dns/set allow-remote-requests=no
```

### Additional Services

RouterOS includes several services that may be enabled depending on your configuration. The following services should be disabled in production environments: caching proxy, SOCKS, UPnP, and MikroTik Cloud services.

```ros
/ip/proxy/set enabled=no
/ip/socks/set enabled=no
/ip/upnp/set enabled=no
/ip/cloud/set ddns-enabled=auto update-time=no
```

### Management service ports

Disable the RouterOS management services you do not use, in the `/ip/service` menu:

```ros
/ip/service/disable telnet,ftp,www,api
```

Changing the default SSH port can reduce exposure to automated brute-force attempts:

```ros
/ip/service/set ssh port=2200
```

Each service can also be restricted to specific source addresses, although enforcing access control with firewall rules (above) is preferred, as it prevents the connection from reaching the service at all:

```ros
/ip/service/set winbox address=192.168.88.0/24
```

### More Secure SSH Access

You can enable stricter SSH security settings on your router. This includes enabling the aes-128-ctr encryption algorithm and disabling hmac-sha1 and group algorithms with sha1. To apply these more secure SSH settings, use the following command:

```ros
/ip/ssh/set strong-crypto=yes
```

## Router interface

### Ethernet/SFP interfaces

It is good practice to disable all unused interfaces on your router to decrease unauthorized access to your router:

```ros
/interface/print 
/interface/set X disabled=yes
```

Where **X** is the number of the unused interface.

### LCD

Some RouterBOARD devices include an LCD module for displaying system information. To secure the LCD, set a PIN code:

```ros
/lcd/pin/set pin-number=3659 hide-pin-number=yes
```

Alternatively, you can disable the LCD entirely:

```ros
/lcd/set enabled=no
```
