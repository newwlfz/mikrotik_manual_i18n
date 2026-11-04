---
sidebar_key: "routing-and-networking-protocols/multicast/igmp-proxy"
sidebar_position: 2
title: "IGMP Proxy"
slug: /user-guides/routing-and-networking-protocols/multicast/igmp-proxy
source: https://manual.mikrotik.com/docs/7.24/user-guides/routing-and-networking-protocols/multicast/igmp-proxy
captured_at: '2026-11-04T11:33:54+08:00'
---

The Internet Group Management Protocol (IGMP) proxy can implement multicast routing. It is forwarding IGMP frames and is commonly used when there is no need for a more advanced protocol like PIM.

## IGMP proxy features

- The simplest way to do multicast routing.
- Can be used in topologies where PIM-SM is not suitable for some reason.
- It takes slightly less resources than PIM-SM.
- Ease of configuration.

On the other hand, IGMP proxy is not well suited for complicated multicast routing setups. Compared to PIM-based solutions, IGMP proxy does not support more than one upstream interface and routing loops are not detected or avoided.

By default, the IGMP proxy upstream interface will send IGMPv3 membership reports and it will detect what IGMP version the upstream device (e.g. multicast router) is using based on received queries. If IGMPv1/v2 queries are received, the upstream port will fall back to the lower IGMP version. It will convert back to IGMPv3 when the IGMPv1/v2 querier present timer (400s) expires. Downstream interfaces of the IGMP proxy will only send IGMPv2 queries.

:::warning
RouterOS v7 has IGMP proxy configuration available in the main **system** package. Older RouterOS versions need an additional **multicast** package installed in order to use IGMP proxy. See more details about [Packages](/docs/7.24/getting-started/installation-and-upgrade/packages).
:::

## Examples

---

To forward all multicast data coming from the ether2 interface to the downstream bridge interface, where subscribers are connected, use the configuration below. Both interfaces should have an IP address.

```ros
/routing/igmp-proxy/interface
add interface=ether2 upstream=yes
add interface=bridge1

[admin@MikroTik] /routing/igmp-proxy/interface/print
Flags: U - UPSTREAM
Columns: INTERFACE, THRESHOLD
#   INTERFACE  THRESHOLD
0 U ether2             1
1   bridge1            1
```

You may also need to configure `alternative-subnets` on the upstream interface in case the multicast sender address is in an IP subnet that is not directly reachable from the local router:

```ros
/routing/igmp-proxy/interface
set [find upstream=yes] alternative-subnets=192.168.50.0/24,192.168.60.0/24
```
