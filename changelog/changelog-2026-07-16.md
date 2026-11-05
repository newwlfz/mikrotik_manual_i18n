---
title: "Documentation updates - July 16, 2026"
date: 2026-07-16
slug: /changelog-2026-07-16
source: https://manual.mikrotik.com/changelog/changelog-2026-07-16
captured_at: '2026-11-04T06:08:13+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on July 16, 2026.

## Authentication & AAA

- **[Certificates](/docs/authentication-authorization-accounting/certificates)**: Added the full list of built-in root certificate authorities, with organization, common name, and subject ID for each — covering Amazon, DigiCert, GlobalSign, Go Daddy, Sectigo, USERTrust, and ISRG roots. A separate table documents the reduced trust store on SMIPS devices (DigiCert Global Root G2, ISRG Root X1/X2, ISRG Root YE/YR). The list is also noted as accessible at /certificate/builtin/.

## System

- **[Scheduler](/docs/system-information-and-utilities/scheduler)**: Documented the days parameter, which restricts a task to specific days of the week (mon,wed,fri, or always). The property list was converted to a proper table and gained the policy parameter, start-time=startup is now documented on the start-time row, and a new example shows a task that runs only on business days. Also clarified how days, start-time, and interval interact.

## Hardware

- **[RouterBOARD](/docs/hardware/routerboard)**: Added a note that on-event scripts for the Mode, Reset, and WPS buttons execute with read,write,reboot,ftp,romon,test permissions.

## Network Management

- **[DHCP](/docs/network-management/dhcp)**: Filled in previously empty property descriptions for the DHCP client (custom-source-mac-address, custom-hostname-suffix, caps-managers) and the DHCP server (address-lists, use-reconfigure). Expanded add-dns-entries and add-dns-entries-suffix to explain how the FQDN is built from the client hostname, and added a note that the parent DNS zone must already exist — the DHCP server does not create it.

## Getting Started

- **[x86 licensing](/docs/getting-started/routeros-licensing/x86)**: Added a FAQ entry on correcting a mistyped Software ID on a purchased key, with step-by-step instructions for the "Fix Software ID" option in the mikrotik.com account.
- **[RouterOS licensing](/docs/getting-started/routeros-licensing)**: Internal links across the licensing pages now use Docusaurus routes.

## Hardware Guides

- **[Hardware guides](/hardware)**: Fixed broken URLs, heading hierarchy, and table-cell headings across 80 switch and wireless system pages, and replaced remaining Confluence help links with Docusaurus routes.
