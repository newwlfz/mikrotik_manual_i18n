---
sidebar_key: "cli-reference/ipv6/dhcp-server/binding/send-reconfigure"
sidebar_position: 3
title: "send-reconfigure"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ipv6/dhcp-server/binding/send-reconfigure
captured_at: '2026-11-01T21:24:36+08:00'
---

-----------

## ipv6/dhcp-server/binding/send-reconfigure 
**Type:** Command

Sends a Reconfigure message to the client of the binding, which makes the client renew immediately. Requires `use-reconfigure=yes` on the server and a client that accepts Reconfigure messages, for example a RouterOS DHCPv6 client with `allow-reconfigure=yes`.
