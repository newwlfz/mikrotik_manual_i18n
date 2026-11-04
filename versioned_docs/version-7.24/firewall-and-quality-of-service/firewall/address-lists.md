---
sidebar_key: "firewall-and-quality-of-service/firewall/address-lists"
sidebar_position: 1
title: "Address-lists"
source: https://manual.mikrotik.com/docs/7.24/firewall-and-quality-of-service/firewall/address-lists
captured_at: '2026-11-04T11:28:07+08:00'
---

The following example creates a dynamic address list of people who are connecting to port 23 (telnet) on the router and drops all further traffic from them for 5 minutes. Additionally, the address list will also contain one static address list entry of 192.0.34.166/32 ([www.example.com](http://www.example.com)):

```ros
/ip/firewall/address-list/add list=drop_traffic address=192.0.34.166/32
```

```ros
/ip/firewall/address-list/print
Flags: X - disabled, D - dynamic
 #   LIST         ADDRESS
 0   drop_traffic 192.0.34.166
```

```ros
/ip/firewall/mangle/add action=add-src-to-address-list address-list=drop_traffic address-list-timeout=5m chain=prerouting dst-port=23 protocol=tcp
/ip/firewall/filter/add action=drop chain=input src-address-list=drop_traffic
```

```ros
/ip/firewall/address-list/print
Flags: X - disabled, D - dynamic
 #   LIST         ADDRESS
 0   drop_traffic 192.0.34.166
 1 D drop_traffic 1.1.1.1
 2 D drop_traffic 10.5.11.8
```

As seen in the output of the last print command, two new dynamic entries appeared in the address list (marked with a status of 'D'). Hosts with these IP addresses tried to initialize a telnet session to the router and were subsequently dropped by the filter rule.
