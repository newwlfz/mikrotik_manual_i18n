---
sidebar_key: "cli-reference/ppp/l2tp-secret"
sidebar_position: 3
title: "l2tp-secret"
sidebar_label: 'l2tp-secret'
source: https://manual.mikrotik.com/docs/cli-reference/ppp/l2tp-secret
captured_at: '2026-11-28T10:14:44.799Z'
---

-----------

## ppp/l2tp-secret 
**Type:** Directory

Secrets of L2TP tunnels, by client address. See [PPP AAA](/docs/authentication-authorization-accounting/ppp-aaa) for the full guide.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { address: ipPrefix
, ipv6-address: ip6Prefix
 }">Address or network of the L2TP clients that must use the secret.</ArgTableRow>
<ArgTableRow arg="secret" typ="string">Secret of the L2TP tunnel. A client from `address` that does not use it cannot connect.</ArgTableRow>
</ArgTable>
