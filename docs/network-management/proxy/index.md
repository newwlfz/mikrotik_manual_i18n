---
sidebar_key: "network-management/proxy"
title: "Proxy"
sidebar_label: 'Proxy'
description: 'RouterOS has two web proxies: the web proxy forwards, filters and caches the web requests of clients on your network, and the reverse proxy makes web servers behind the router reachable over HTTPS by host name.'
tags:
  - 'proxy'
  - 'reverse-proxy'
source: https://manual.mikrotik.com/docs/network-management/proxy
captured_at: '2026-11-09T11:35:47.715Z'
---

A proxy accepts a request from a client and connects to the server on the client's behalf. RouterOS has two proxies for web traffic, and they work in opposite directions:

| Proxy | Menu | Clients | Servers | Use it to |
| :-- | :-- | :-- | :-- | :-- |
| [Web proxy](/docs/network-management/proxy/web-proxy) | `/ip/proxy` | On your network | On the internet | Filter and cache the web requests of your users, or send them through another proxy. |
| [Reverse proxy](/docs/network-management/proxy/reverse-proxy) | `/ip/reverse-proxy` | On the internet | Behind the router | Make web servers behind the router reachable over HTTPS by host name. |

For applications other than web browsers, RouterOS also has a [SOCKS proxy](/docs/network-management/socks/) in `/ip/socks`.
