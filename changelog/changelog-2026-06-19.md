---
title: "Documentation updates - June 19, 2026"
date: 2026-06-19
slug: /changelog-2026-06-19
source: https://manual.mikrotik.com/changelog/changelog-2026-06-19
captured_at: '2026-11-04T06:08:03+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 19, 2026.

## Management Tools

- **[WebFig](/docs/management-tools/webfig#enable-https)**: Restructured the Enable HTTPS section around LAN-only use. It now leads with self-signed certificates (the default when reaching the router by its private LAN IP, since public CAs cannot issue for private addresses) and explains how to remove browser warnings by trusting the router's root CA. The Let's Encrypt/ACME path is now a clearly-scoped option for routers reached by a real public domain name, noting the private-IP, name-match, and split-DNS caveats and the no-WAN-port DNS-01 challenge.

## Authentication & AAA

- **[Certificates](/docs/authentication-authorization-accounting/certificates#acme-client)**: Cleaned up the Let's Encrypt/ACME, CRL, and Settings sections. Command and parameter references (the a flag, crl-use, crl-download, /certificate/settings) are now formatted as inline code instead of broken italic/quoted markup, the IP Cloud DNS-01 sentence was clarified with a link to the IP Cloud DDNS page, and the first add-acme example uses a concrete domain.

## Getting Started

- **[First Time Configuration](/docs/getting-started/first-time-configuration)**: Added a wireless setup video, now embedded as a proper &lt;video&gt; player sourcing the clip from static/videos/.
