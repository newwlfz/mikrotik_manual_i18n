---
sidebar_key: "cli-reference/ip/nat-pmp/index"
sidebar_position: 1
title: "nat-pmp"
sidebar_label: 'nat-pmp'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/nat-pmp
captured_at: '2026-11-01T21:24:17+08:00'
---

-----------

## ip/nat-pmp 
**Type:** Settings Directory

NAT Port Mapping Protocol (NAT-PMP, [RFC 6886](https://www.rfc-editor.org/rfc/rfc6886)) service settings. While enabled, the service waits for mapping requests from the internal interfaces on UDP port 5351, shown as a dynamic `natpmp` entry in `/ip/service`. Configuration examples are on the [NAT-PMP guide page](/docs/7.25/firewall-and-quality-of-service/nat-pmp).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Enable the NAT-PMP service. Default: no.</ArgTableRow>
</ArgTable>
