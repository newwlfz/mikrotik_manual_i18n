---
title: "Documentation updates - June 17, 2026"
date: 2026-06-17
slug: /changelog-2026-06-17
source: https://manual.mikrotik.com/changelog/changelog-2026-06-17
captured_at: '2026-11-04T06:08:00+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 17, 2026.

## Authentication & AAA

- **[Certificates](/docs/7.24/authentication-authorization-accounting/certificates#crl)**: Added a dedicated CRL (Certificate Revocation List) section documenting how RouterOS verifies certificates against their CRL. Explains enabling crl-use=yes and crl-download=yes, and adding CRLs manually by URL or dynamically from a certificate's CRL Distribution Point. Includes a property table for the /certificate/crl menu (akid, cert, dynamic, expired, fingerprint, last-update, next-update, num, removed, signature, url).

## Management Tools

- **[WebFig](/docs/7.24/management-tools/webfig)**: Rewrote and updated the WebFig page with clearer wording and fresh screenshots. The HTTPS setup steps were revised to use an end-entity certificate and the www-ssl service, the Terminal section was tidied, and the **Design Skin** section was restructured with clearer descriptions of each operation (hide menu/submenu/tabs, rename, notes, read-only, flags) plus examples for numeric-interval (1..10) and prefix (station$) field limits.
