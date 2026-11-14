---
sidebar_key: "system-information-and-utilities/interface-lists"
sidebar_position: 7
title: "Interface Lists"
sidebar_label: 'Interface Lists'
description: 'Interface Lists in RouterOS allow defining sets of interfaces for simplified management across various configurations. The main menu lists predefined and custom interface lists, while the member sub-menu handles statically configured members. Dynamic interfaces are automatically included or excluded based on flags, and bridges require careful handling to avoid unintended behavior.'
tags:
  - 'interface-lists'
  - 'firewall'
  - 'bridging'
source: https://manual.mikrotik.com/docs/7.24/system-information-and-utilities/interface-lists
captured_at: '2026-11-07T17:11:03.548Z'
---

Allows defining a set of interfaces for easier interface management in the different interface-based configuration sections such as Neighbor Discovery, Firewall, Bridge, and Internet Detect.

## Lists

**Sub-menu:** `/interface/list`

This menu contains information about all interface lists available on the router. There are four predefined lists - `all` (contains all interfaces), `none` (contains no interfaces), `dynamic` (contains dynamic interfaces), and `static` (contains static interfaces). It is also possible to create additional interface lists.

:::info
Dynamic interfaces are interfaces that have a "dynamic" flag. Any interface that doesn't have a dynamic flag will be part of the `static` interface list.
:::

| Property | Description |
| :-- | :-- |
| **name** (*string*) | Name of the interface list |
| **include** (*string*) | Defines the interface list whose members are included in the list. It is possible to add multiple lists separated by commas |
| **exclude** (*string*) | Defines the interface list whose members are excluded from the list. It is possible to add multiple lists separated by commas |

Members are added to the interface list in the following order:

1. Include members are added to the interface list.
2. Exclude members are removed from the list.
3. Statically configured members are added to the list.

## Members

**Sub-menu:** `/interface/list/member`

This sub-menu contains information about statically configured interface members of each interface list. Note that dynamically added interfaces by include and exclude statements are not represented in this sub-menu.

| Property | Description |
| :-- | :-- |
| **interface** (*string*) | Name of the interface |
| **list** (*string*) | Name of the interface list |

:::info
Care must be taken when working with bridges and lists. Adding a bridge as a member is not the same as adding all its ports! And adding all slave ports as members is not the same as adding the bridge itself. This can particularly impact the functionality of neighbor discovery.
:::
