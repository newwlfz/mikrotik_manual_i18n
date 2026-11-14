---
sidebar_key: "internet-of-things/lora/user-guides/step-by-step-installation"
sidebar_position: 3
title: "Step by step installation"
sidebar_label: 'Step by step installation'
description: 'This page provides a step-by-step guide for installing and configuring LoRa mini-PCIe cards on MikroTik RouterOS, including hardware installation, GUI setup, package management, and initial network server configuration.'
tags:
  - 'lora'
  - 'winbox'
source: https://manual.mikrotik.com/docs/internet-of-things/lora/user-guides/step-by-step-installation
captured_at: '2026-11-09T11:35:47.715Z'
---

### LoRa card installation

LtAP LTE kit will be used as an example in this section.

Open your router's case. For LtAP specifically, once you have removed all the screws, carefully move the upper case to the left side, as the LTE antennas are attached to the inner side of it:

![1.png](/img/e6edfdc7248e1ed2.webp)

Insert R11e-LoRa card into the mini-PCIe slot and apply two screws to the threaded inserts:

![](/img/3216d372cb58a8f1.webp)

Attach antenna to the card (UFL connector). In this case UFL → SMA cable is also used, as the LtAP's case has a specific slot for it.

![](/img/05f26ab703eb8d36.webp)

Once the previous steps are done, you can close the router's case and move on to configuration.

### Configuration

#### GUI setup

Connect to your router via Winbox or WebFig.

Winbox can be downloaded from the [link](https://mikrotik.com/download/winbox).

Run it:

![](/img/b7d80526b099c3a2.webp)

It is highly recommended to upgrade your RouterOS version to the latest available. Installing the version will perform a reboot:

![](/img/64b1cc1f682aa7fd.webp)

If your device does not have the **IoT>LoRa** menu, download "**Extra packages**" specifically for your router's architecture and rOS version. You can see the type of your router's architecture at the top of the Winbox window or in System →  Resources → Architecture Name.
[https://mikrotik.com/download](https://mikrotik.com/download)
![](/img/7decbeb5ac631167.webp)

Once the package is downloaded and extracted, upload the **IoT** package to your router. It can be done via drag & drop as well. It should appear in the files folder after the upload is complete. Reboot your router (System → Reboot) to install the package:
![](/img/c32844e13e18cf6c.webp)

After the reboot, the package should be visible in the Package list:
![](/img/ce2d0ed5613a49ce.webp)

Check if the LoRa gateway has initialized under **IoT>LoRa>Devices**. If it is an LtAP model, make sure to set USB Type to Mini-PCIe:
![](/img/d9b29f2a829113c8.webp)

Once the gateway has shown up (under **IoT>LoRa>Devices**), select it, choose Network Servers from the default ones or add your own (under **IoT>LoRa>Servers**) and enable it:
![](/img/fe16df773e7591ff.webp)

Navigate to the Traffic tab to monitor the surrounding nodes sending requests:
![](/img/399073389e674daf.webp)

This concludes basic installation and configuration of LoRa mini-PCIe cards. For additional settings check: [General Properties](/docs/internet-of-things/lora/general-properties)
