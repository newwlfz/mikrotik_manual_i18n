---
title: "Documentation updates - June 5, 2026"
date: 2026-06-05
slug: /changelog-2026-06-05
source: https://manual.mikrotik.com/changelog/changelog-2026-06-05
captured_at: '2026-11-04T06:07:52+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on June 5, 2026.

## CLI Reference

- **[BGP](/docs/cli-reference/routing/bgp/)**: Fixed grammar in the vrf parameter description ("connections operates" → "connections operate"), corrected typo in input.last-notification ("notificatin" → "notification"), and cleaned up duplicate HTML in the input.affinity description. Fixed "NPLRI" → "NLRI" in the output.no-early-cut description. Corrected "RDs form" → "RDs from" in the EVPN rd parameter.
- **[OSPF](/docs/cli-reference/routing/ospf/interface-template)**: Corrected the default network type descriptions for ptp interfaces from "point-to-point" to the proper "ptp" value, and added missing periods in action descriptions.
- **[RIP](/docs/cli-reference/routing/rip/instance)**: Fixed swapped descriptions between route-timeout and update-interval — the timeout description was incorrectly assigned to the update-interval parameter. Added a missing period in originate-default.
- **[Routing Filter](/docs/cli-reference/routing/filter/rule)**: Removed unhelpful "ask Google" note from the communities parameter description.
- **[Router ID](/docs/cli-reference/routing/id)**: Added the missing only-static option to the Router ID selection documentation, which picks only statically configured addresses.
- **[Fantasy Routing](/docs/cli-reference/routing/fantasy)**: Fixed "refix length" typo → "Prefix length" in the prefix-length parameter description.
- **[PIM-SM](/docs/cli-reference/routing/pimsm/)**: Integrated the previously out-of-place spt-bit flag description into the proper ArgTableRow, so it renders correctly alongside other flags instead of floating as plain text.

## Developer Guides

- **[Scripting](/docs/developer-guides/scripting/)**: Fixed the form feed escape character hex value (\f was incorrectly listed as 0xFF, corrected to 0x0C). Fixed the :resolve command example (port= → server-port=). Cleaned up trailing whitespace and inconsistent indentation across code examples.
- **[API](/docs/developer-guides/api/)**: Fixed the length encoding specification (maximum changed from 0x7FFFFFFFFF to 0xFFFFFFFFF). Corrected the VLAN interface query example (type=ether → type=vlan). Fixed "high-performance penalty" → "high performance penalty" in the .proplist documentation.
- **[REST API](/docs/developer-guides/rest-api)**: Fixed the GET filter example description filter ("valid addresses" → "dynamic addresses"). Corrected the POST documentation to state that command words are encoded in the URL (not the header). Fixed .proplist example (was incorrectly using _proplist). Fixed several example calls to use HTTPS and corrected the number → numbers parameter typo in the LTE firmware upgrade example. Fixed the REST API index description to remove the redundant "Developer guides cover" prefix.
- **[Python3 API Example](/docs/developer-guides/api/python3-example)**: Fixed "Becasue" → "Because" typo and "pasword" → "password" typo. Fixed indentation of argument parsing code that was broken.

## Containers

- **[Available Apps](/docs/containers/apps/available-apps)**: New page added listing over 100 available container applications deployable from the RouterOS App menu, covering categories such as home automation, media servers, file sharing, network monitoring, and development tools.
- **[Apps](/docs/containers/apps/)**: Reorganized the Containers directory structure — moved the deprecated apps.rb page into the Apps/ directory and removed a duplicate Containers/ folder that was causing navigation conflicts.

## Getting Started

- **[Netinstall](/docs/getting-started/installation-and-upgrade/netinstall/)**: Fixed broken relative and absolute links across 5 files after the Netinstall page was moved from getting-started/ into getting-started/installation-and-upgrade/. Updated inbound links in Configuration Management, RouterOS Licensing, Device Mode, and the May 29 changelog entry.
