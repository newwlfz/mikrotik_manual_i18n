---
title: "Documentation updates - October 21, 2026"
date: 2026-10-21T00:00:00.000Z
slug: /changelog-2026-10-21
source: https://manual.mikrotik.com/changelog/changelog-2026-10-21
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - October 21, 2026

October 21, 2026

Summary of documentation changes made on October 21, 2026.

## Management Tools

-   **[CMR](/docs/management-tools/cmr/)**: Added the console options that are new in the current CMR build, each checked against the console of a CMR server: the client accepts `pairing-requirement=confirm` like the server, `auto-labels` accepts `ssid`, `port-labels` separates the labels of one port with `/` and the ports with `,`, and `/cmr/device/export` and `/cmr/device/add` print and create device entries. The [CMR-Client](/docs/management-tools/cmr/client) page and the [`/cmr/client`](/docs/cli-reference/cmr/client/) CLI reference describe client-side `confirm`.

## Authentication & AAA

-   **[Certificates](/docs/authentication-authorization-accounting/certificates)**: New note: a certificate cannot be removed while its ACME update is in progress. If an ACME certificate fails to renew and stays in an error state, `remove` fails with `cannot remove certificate while acme update is in progress`; restart the router and remove the certificate afterwards. Also added to the 7.25 and 7.24 manuals.
