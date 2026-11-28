---
title: "Documentation updates - September 22, 2026"
date: 2026-09-22T00:00:00.000Z
slug: /changelog-2026-09-22
source: https://manual.mikrotik.com/changelog/changelog-2026-09-22
captured_at: '2026-11-28T10:15:48.545Z'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

# Documentation updates - September 22, 2026

September 22, 2026

Summary of documentation changes made on September 22, 2026.

## Containers

-   **[Apps](/docs/containers/apps#yaml-reference)**: Added a YAML field reference for writing your own apps. It covers app-level and service fields, health checks, runtime placeholders, volumes, secrets, configs and networks, each with an example. Also fixed typos and example formatting.
-   **[Apps](/docs/containers/apps#custom-app-store)**: Added a section on custom app stores: host a YAML list of app definitions on a server the router can reach, with a two-app example.

## Bridging & Switching

-   **[Bridging and Switching](/docs/bridging-and-switching#create-edge-ports-and-enable-bpdu-guard)**: Combined the edge port and BPDU Guard examples into one. The new example shows the log entry and the inactive port flag when a port receives a BPDU, and how to re-enable the port. Removed the section on dropping BPDUs with switch ACL rules.
