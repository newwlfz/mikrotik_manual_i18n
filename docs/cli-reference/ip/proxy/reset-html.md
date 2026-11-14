---
sidebar_key: "cli-reference/ip/proxy/reset-html"
sidebar_position: 11
title: "reset-html"
sidebar_label: 'reset-html'
source: https://manual.mikrotik.com/docs/cli-reference/ip/proxy/reset-html
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## ip/proxy/reset-html 
**Type:** Command

Writes the default template of the proxy's error page to the file `webproxy/error.html` on the router and replaces a changed copy. The proxy builds its error pages, for example the page for a request denied by [`/ip/proxy/access`](/docs/cli-reference/ip/proxy/access/), from this file, so you can edit it; the proxy uses the changed file at once. Without the file, the proxy uses the same page built in. The template uses the variables `$(status)`, `$(url)`, `$(error)`, `$(admin)` (the `cache-administrator` setting) and `$(signature)`, and the block `$(if error)` ... `$(endif)`. For an overview, see [Web Proxy](/docs/network-management/proxy/web-proxy).
