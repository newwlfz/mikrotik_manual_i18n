---
sidebar_key: "cli-reference/ip/proxy/lookups"
sidebar_position: 9
title: "lookups"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/proxy/lookups
captured_at: '2026-11-01T21:24:22+08:00'
---

-----------

## ip/proxy/lookups 
**Type:** Settings Directory

Counters of the requests the proxy looks up in its cache. For an overview of caching, see [Web Proxy](/docs/network-management/proxy/web-proxy).

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="successes" typ="num">Requests answered from the cache.</ArgTableRow>
<ArgTableRow arg="not-found" typ="num">Requests for objects that are not in the cache.</ArgTableRow>
<ArgTableRow arg="non-cacheable" typ="num">Requests the proxy does not look up in the cache because of their method, for example `POST` and `HEAD`.</ArgTableRow>
<ArgTableRow arg="denied" typ="num">Requests matched by a [`/ip/proxy/cache`](/docs/cli-reference/ip/proxy/cache/) rule with `action=deny`.</ArgTableRow>
<ArgTableRow arg="expired" typ="num">Requests for an object found in the cache that the proxy fetched from the server again.</ArgTableRow>
<ArgTableRow arg="no-expiration-info" typ="num"></ArgTableRow>
</ArgTable>
