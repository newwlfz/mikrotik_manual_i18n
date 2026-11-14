---
title: "Documentation updates - October 13, 2026"
date: 2026-10-13T00:00:00.000Z
slug: /changelog-2026-10-13
---

# Documentation updates - October 13, 2026

October 13, 2026

Summary of documentation changes made on October 13, 2026.

## User Guides[​](#user-guides "Direct link to User Guides")

-   **[Route Selection and Filtering](/docs/user-guides/routing-and-networking-protocols/route-selection-and-filtering#community-regexp-matching)**: New "Community Regexp Matching" section. A community list entry holds either concrete `communities` or a `regexp`, and one list can mix both. The regexp is matched against the printed form of each community: `asn:value` or a well-known name for standard communities, the typed `rt:`/`soo:` form for extended communities, and three decimal fields for large communities. Examples delete or reject routes by the administrative domain of their large communities. Also new: on a route without the community attribute the "any" matchers return false and the "subset" matchers return true, so use `bgp-communities-empty` (or the extended and large variants) to test for an empty attribute; `delete` with a list also removes the communities that match its regexp entries, while `append` and `set` use only the concrete values.

## Getting Started[​](#getting-started "Direct link to Getting Started")

-   **[IPv6 Neighbor Discovery](/docs/getting-started/networking-fundamentals/ipv6-neighbor-discovery)**: The `/ipv6/nd` entry for interface `all` has lower priority than an entry configured for a specific interface.

## Management Tools[​](#management-tools "Direct link to Management Tools")

-   **[CMR](/docs/management-tools/cmr#run-script-permissions)**: The run-script permissions section lists `/system backup save`, `/system reset-configuration` and `/file copy` among the refused commands. `/export` works and returns the client's configuration, so `run-script` can collect configuration exports from the fleet; sensitive values stay hidden (`/export` leaves them out, `show-sensitive` does not reveal them, and `get` shows them as `*`).

## Hardware[​](#hardware "Direct link to Hardware")

-   **[KNOT LR8G kit](/hardware/knot-lr8g-kit)**, **[KNOT LR9G kit](/hardware/knot-lr9g-kit)**: Corrected for the G kits: the GPS module is on the LoRa card (no GLONASS, BeiDou or Galileo), and the microUSB port is for peripherals only, not for powering. The GNSS configuration section is now GPS configuration and links to the GPS guide; the BG77 AT-command instructions are replaced by two antenna checks (the U.FL pigtail from the LoRa card to the SMA port, and the external antenna on the SMA port labeled GNSS). The Modbus configuration guide is linked.

**Tags:**

-   [Documentation changelog](/changelog/tags/changelog "Daily summary of documentation updates")
