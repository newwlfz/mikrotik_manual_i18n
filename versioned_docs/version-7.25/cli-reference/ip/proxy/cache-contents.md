---
sidebar_key: "cli-reference/ip/proxy/cache-contents"
sidebar_position: 3
title: "cache-contents"
sidebar_label: 'cache-contents'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/proxy/cache-contents
captured_at: '2026-11-01T21:24:20+08:00'
---

-----------

## ip/proxy/cache-contents 
**Type:** Directory

Objects in the cache of the web proxy. Remove an entry to make the proxy fetch the object from the server on the next request. To empty the whole cache, use [`clear-cache`](/docs/7.25/cli-reference/ip/proxy/clear-cache). For an overview of caching, see [Web Proxy](/docs/7.25/network-management/proxy/web-proxy).

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="uri" typ="string">URL of the object.</ArgTableRow>
<ArgTableRow arg="file-size" typ="num">Size of the object, in KiB.</ArgTableRow>
<ArgTableRow arg="last-modified" typ="date">Date the proxy stored the object. It is not the `Last-Modified` header of the response.</ArgTableRow>
<ArgTableRow arg="last-modified-time" typ="date">Time the proxy stored the object.</ArgTableRow>
<ArgTableRow arg="last-accessed" typ="date"></ArgTableRow>
<ArgTableRow arg="last-accessed-time" typ="date"></ArgTableRow>
</ArgTable>
