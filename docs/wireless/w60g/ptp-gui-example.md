---
sidebar_key: "wireless/w60g/ptp-gui-example"
sidebar_position: 6
title: "PtP GUI example"
sidebar_label: 'PtP GUI example'
description: 'This guide demonstrates configuring a transparent wireless bridge between two MikroTik W60G devices using WinBox, covering interface setup, bridge creation, wireless mode configuration for both bridge and station roles, and additional security recommendations.'
tags:
  - 'bridging'
  - 'wireless'
  - 'winbox'
source: https://manual.mikrotik.com/docs/wireless/w60g/ptp-gui-example
captured_at: '2026-11-09T11:35:47.715Z'
---

### Summary

This example shows how to configure a transparent wireless bridge in the GUI from one W60G device to another.

Example is done from an empty configuration state with the [[WinBox](https://mikrotik.com/download)] utility

### Connect to the device

After configuration reset - only mac-telnet is possible. In the main WinBox screen press on Neighbours, choose your device's MAC address and press Connect:

![](/img/35b82e384ea98fed.webp)

### Configure bridge

Add a new bridge and assign bridge members to it. This will allow passing traffic from Ethernet to W60G interface without routing:

1. Open the Bridge sub-menu;
2. Press on "+" to add a new bridge;
3. Apply your changes.

![](/img/c99185067ee63bea.webp)

Add interface members (ether1 and wlan60-1) to newly created bridge:

1. Press on the Ports sub-menu;
2. Add a new member with "+";
3. Select the correct interfaces;
4. Apply the settings.

![](/img/d0275e2820cf50b4.webp)

![](/img/2d6695312a5e1d14.webp)

### Set up wireless connection

All previously explained steps are identical to **bridge** and **station** devices. Different modes need to be used when configuring wireless interfaces.

Configure **bridge** device as follows:

1. Open the Interface menu;
2. Double click on the wlan60-1 interface;
3. Press Wireless sub-menu and set mode to **bridge**;
4. Set SSID and password and region;
5. Select the previously created bridge under "Put Stations In Bridge";
6. Apply your changes;
7. Press enable to start transmitting.

![](/img/7d465133495ed1ce.webp)

Configure **station** device as follows:

1. Open the Interface menu;
2. Double click on wlan60-1 interface;
3. Press the Wireless sub-menu and set mode to **station bridge**;
4. Set SSID and password;
5. Apply your changes;
6. Press enable to start transmitting.

![](/img/a09cd3c87e452fe7.webp)

### Additional configuration

Interfaces, when enabled from greyed out, will become active.

The link should be established after all previously explained steps are done. It's recommended to set up an administrator password on both devices.

To create a point to multi-point setup: On the bridge device ap-bridge must be set and station-bridge for stations.
