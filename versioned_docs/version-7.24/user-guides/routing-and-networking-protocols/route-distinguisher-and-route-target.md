---
sidebar_key: "routing-and-networking-protocols/route-distinguisher-and-route-target"
sidebar_position: 7
title: "Route Distinguisher and Route Target"
sidebar_label: 'Route Distinguisher and Route Target'
description: 'Route Distinguisher (RD) adds unique prefixes to customer addresses for VRF differentiation, while Route Targets control BGP routing information exchange between instances.'
tags:
  - 'bgp'
  - 'routing'
  - 'vrf'
slug: /user-guides/routing-and-networking-protocols/route-distinguisher-and-route-target
source: https://manual.mikrotik.com/docs/7.24/user-guides/routing-and-networking-protocols/route-distinguisher-and-route-target
captured_at: '2026-11-04T11:33:58+08:00'
---

## Route Distinguisher

A Route Distinguisher is a unique prefix added to a customer's destination address to distinguish advertisements that might otherwise look the same. For example, overlapping VRF subnets can be distinguished by unique route distinguishers.

An RD is a 64-bit integer and is split into three parts:

- Type (always 2 bytes).
- Administrator subfield.
- Value or service-provider subfield.

Currently, three format types are defined.

| **2 bytes**   | 2 bytes     | 4 bytes      |          |
|:--|:--|:--|:--|
| **Type 0**    | ASN        | 4-byte value |          |
| **Type 1**    | 4-byte IP  | 2-byte value |          |
| **Type 2**    | 4-byte ASN | 2-byte value |          |

## Route Targets

A Route Target is a BGP extended community that controls the import and export of routing information between routing instances.
