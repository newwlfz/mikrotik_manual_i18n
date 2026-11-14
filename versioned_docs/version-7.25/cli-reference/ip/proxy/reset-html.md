---
sidebar_key: "cli-reference/ip/proxy/reset-html"
sidebar_position: 11
title: "reset-html"
sidebar_label: 'reset-html'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/proxy/reset-html
captured_at: '2026-11-01T21:24:24+08:00'
---

-----------

## ip/proxy/reset-html 
**Type:** Command

Writes the default template of the proxy's error page to the file `webproxy/error.html` on the router and replaces a changed copy. The proxy builds its error pages, for example the page for a request denied by [`/ip/proxy/access`](/docs/7.25/cli-reference/ip/proxy/access/), from this file, so you can edit it; the proxy uses the changed file at once. Without the file, the proxy uses the same page built in. The template uses the variables `$(status)`, `$(url)`, `$(error)`, `$(admin)` (the `cache-administrator` setting) and `$(signature)`, and the block `$(if error)` ... `$(endif)`. For an overview, see [Web Proxy](/docs/7.25/network-management/proxy/web-proxy).
