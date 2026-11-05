---
sidebar_key: "cli-reference/ip/dns/cache/all"
sidebar_position: 1
title: "all"
description: 'RouterOS directory reference for /ip/dns/cache/all.'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/ip/dns/cache/all
captured_at: '2026-11-01T21:28:32+08:00'
---

-----------

## ip/dns/cache/all 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="S" typ="static">static</ArgTableRow>
<ArgTableRow arg="N" typ="negative">negative</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="type" typ="enum (A | NS | MD | MF | CNAME | SOA | MB | MG | MR | NULL | WKS | PTR | HINFO | MINFO | MX | TXT | AAAA | SRV) { A:1, NS:2, MD:3, MF:4, CNAME:5, SOA:6, MB:7, MG:8, MR:9, NULL:10, WKS:11, PTR:12, HINFO:13, MINFO:14, MX:15, TXT:16, AAAA:28, SRV:33 }"></ArgTableRow>
<ArgTableRow arg="data" typ="alt { address: ipAddr
, name: string
, info: composite { rmail: string
, email: string
 }
, mx: composite { preference: num
, exchange: string
 }
, srv: composite { port: num
, target: string
 }
, soa-mname: string
, address6: ip6Addr
 }"></ArgTableRow>
<ArgTableRow arg="ttl" typ="time"></ArgTableRow>
<ArgTableRow arg="responsible" typ="string"></ArgTableRow>
<ArgTableRow arg="serial" typ="num"></ArgTableRow>
<ArgTableRow arg="refresh" typ="num"></ArgTableRow>
<ArgTableRow arg="retry" typ="num"></ArgTableRow>
<ArgTableRow arg="expire" typ="num"></ArgTableRow>
<ArgTableRow arg="minimum" typ="num"></ArgTableRow>
</ArgTable>
