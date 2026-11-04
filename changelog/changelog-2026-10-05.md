---
title: "Documentation updates - October 5, 2026"
date: 2026-10-05
slug: /changelog-2026-10-05
source: https://manual.mikrotik.com/changelog/changelog-2026-10-05
captured_at: '2026-11-04T06:08:58+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 5, 2026.

## Site

- **Documentation versioning**: The documentation for RouterOS 7.25 was frozen as version **7.25** and is selectable from the version dropdown. The current documentation now describes RouterOS 7.26.

## Management Tools

- **[CMR](https://manual.mikrotik.com/docs/management-tools/cmr)**: New guide for CMR, the server in the cmr package that monitors and manages a fleet of RouterOS devices, available from RouterOS 7.26beta1. It covers:

- What CMR does and does not do, how the server and its clients connect, and where a new user starts.
- Enabling the server and its settings, and pairing devices, with the typical scenarios and the password and confirmation requirements on both sides.
- Managing devices: device properties, labels and the label selection syntax (+ for AND, - for AND NOT), and running commands on many devices at once.
- The live dashboard (/cmr/device/dashboard), with a screenshot and a description of its eight sections.
- Fleet upgrades: upgrade rules, starting an upgrade early with trigger, run-next or device/upgrade, the upgrade sources and the local packages-directory, job states and results (a device with no upgrade available counts as a failed upgrade), and the strategy and fail-policy settings.
- Alert rules: conditions, the log, script and webhook actions, the placeholders for action text in device, event and alert groups, and how a rule fires.
- Network topology: layouts, nodes and links, add-devices and rebuild-links, with a verified example and a screenshot.
- Application traffic, central WiFi configuration (networks, radios, how the settings are applied, bridge and VLAN behaviour), and VLAN provisioning with a verified example and the risk of locking out the controller.

- **[CMR-Client](https://manual.mikrotik.com/docs/management-tools/cmr/client)**: New page for the device side, which is part of the main RouterOS package: enabling the client with controller-addresses, pairing from the client and its own pairing-requirement (none, password, or confirm), disconnecting, and troubleshooting.

## CLI Reference

- **[/cmr](https://manual.mikrotik.com/docs/cli-reference/cmr)**, **[/cmr/client](https://manual.mikrotik.com/docs/cli-reference/cmr/client)**: New reference for the CMR server and client, with every parameter described: alert rules (alert, show-devices, test), devices (apptraffic, dashboard, pair, reboot, run-script, upgrade, wifi-logs), topology (layout, node, link, add-devices, rebuild-links), upgrades (upgrade, job, run-next, show-devices, trigger, version-check), and the vlan and wifi provisioning menus.
- **[/interface/ethernet/pon](https://manual.mikrotik.com/docs/cli-reference/interface/ethernet/pon)**, **[/interface/wifi/dashboard](https://manual.mikrotik.com/docs/cli-reference/interface/wifi/dashboard/show)**, **[/system/dashboard](https://manual.mikrotik.com/docs/cli-reference/system/dashboard/show)**, **[/tool/apptraffic](https://manual.mikrotik.com/docs/cli-reference/tool/apptraffic)**: Regenerated the reference for RouterOS 7.26beta1. New commands: PON settings with the ONU identity (onu-model, onu-registration-id, onu-serial-number, onu-vendor-id, also on [/interface/ethernet](/docs/7.24/cli-reference/interface/ethernet)), the WiFi and system dashboards, application traffic statistics, [/interface/wireless/snooper/snoop](/docs/7.24/cli-reference/interface/wireless/snooper/snoop), and reset-counters-all for switch rules. New parameters: dhcp-snooping-vlan-ids on [bridges](/docs/7.24/cli-reference/interface/bridge), current-forwarding-override in [port isolation](/docs/7.24/cli-reference/interface/ethernet/switch/port-isolation), and apn-profile on [LTE interfaces](/docs/7.24/cli-reference/interface/lte). On [/interface/vlan](/docs/7.24/cli-reference/interface/vlan), force-mac-address is now forced-mac-address, and bandwidth is gone from Ethernet and [power-line](/docs/7.24/cli-reference/interface/pwr-line) interfaces.
- **[/interface/wifi/configuration](/docs/7.24/cli-reference/interface/wifi/configuration)**, **[/interface/wifi/network](/docs/7.24/cli-reference/interface/wifi/network)**, **[/caps-man/configuration](/docs/7.24/cli-reference/caps-man/configuration)**: Settings from the sub-menus are now listed with their prefix, as they are set on the command line, for example security.authentication-types. WiFi uses aaa., channel., datapath., interworking., security., and steering.; legacy CAPsMAN uses channel., configuration., datapath., rates., and security..
- **[CLI Reference](/docs/7.24/cli-reference)**: The address argument flags explain i (a bare interface name in place of an address, for example a point-to-point interface as a route gateway) and the new % flag (an interface suffix on an address, such as fe80::1%ether1). Every parameter that accepts IPv6 addresses also accepts a link-local address with its %interface suffix.

## Getting Started

- **[Packages](/docs/7.24/getting-started/installation-and-upgrade/packages)**: Added the cmr package, supported on the arm, arm64, and x86 architectures, with a link to the CMR guide.

## Wireless

- **[WiFi](/docs/7.24/wireless/wifi)**: The ft-preserve-vlanid parameter is not supported by the wifi-qcom-ac drivers.
- **[Wi-Fi 5 (802.11ac)](/docs/7.24/wireless/wifi-ac)**: New warning: the wifi-qcom-ac driver is meant for indoor devices. It installs on the outdoor models (LDF 5 ac, LHG XL 5 ac, LHG XL 52 ac, NetMetal ac², mANTBox 52 15s, SXTsq 5 ac), but it does not support the distance setting that links longer than 2 km need, so use the wireless drivers on outdoor boards.
