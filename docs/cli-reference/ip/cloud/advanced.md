---
sidebar_key: "cli-reference/ip/cloud/advanced"
sidebar_position: 1
title: "advanced"
sidebar_label: 'advanced'
source: https://manual.mikrotik.com/docs/cli-reference/ip/cloud/advanced
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## ip/cloud/advanced 
**Type:** Settings Directory

Advanced DDNS settings. For an overview, see [DDNS](/docs/network-management/cloud/#ddns).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="use-local-address" typ="bool">Whether the DNS name points to the router's local address instead of its public address. With `yes`, `dns-name` resolves to the address the router sends its requests from, for example a private address behind NAT, and `public-address` still shows the public address. Default: no.</ArgTableRow>
</ArgTable>
