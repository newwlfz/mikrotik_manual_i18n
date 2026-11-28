---
title: "send-reconfigure"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ipv6/dhcp-server/binding/send-reconfigure
captured_at: '2026-11-28T10:17:19.424Z'
pagination_next: "cli-reference/ipv6/dhcp-server/option"
---

-----------

## ipv6/dhcp-server/binding/send-reconfigure 
**Type:** Command

Sends a Reconfigure message to the client of the binding, which makes the client renew immediately. Requires `use-reconfigure=yes` on the server and a client that accepts Reconfigure messages, for example a RouterOS DHCPv6 client with `allow-reconfigure=yes`.
