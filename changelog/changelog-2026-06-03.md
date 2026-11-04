---
title: "Documentation updates - June 3, 2026"
date: 2026-06-03
slug: /changelog-2026-06-03
source: https://manual.mikrotik.com/changelog/changelog-2026-06-03
captured_at: '2026-11-04T06:07:50+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 3, 2026.

## Authentication & AAA

- **[Certificates](/docs/7.24/authentication-authorization-accounting/certificates)**: Updated ACME examples so Let's Encrypt certificate generation uses the default directory URL when directory-url is omitted.
- **[Certificates](/docs/7.24/authentication-authorization-accounting/certificates)**: Added wiliot and logging as supported values for trust-store and builtin-trust-store certificate settings.

## Developer Guides

- **[REST API](/docs/7.24/developer-guides/rest-api)**: Clarified HTTP and HTTPS access through the www and www-ssl services and added links to the IP Service and Certificate documentation.

## Mobile Networking

- **[LTE/5G](/docs/7.24/mobile-networking/lte-5g)**: Added offline FOTA/DFOTA modem firmware upgrade guidance, including firmware-file examples for local files and HTTP URLs, modem compatibility tables, and safety warnings.

## Network Management

- **[DNS](/docs/7.24/network-management/dns)**: Added DNS over HTTPS notes for using the built-in certificate authority store and HTTP/2 negotiation on ARM64, x86, and CHR devices.
