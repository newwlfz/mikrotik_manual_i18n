---
sidebar_key: "internet-of-things/lora/user-guides/step-by-step-installation"
sidebar_position: 5
title: "Step by step installation"
description: 'This page provides a step-by-step guide for installing and configuring LoRa mini-PCIe cards on MikroTik RouterOS, including hardware installation, GUI setup, package management, and initial network server configuration.'
source: https://manual.mikrotik.com/docs/7.24/internet-of-things/lora/user-guides/step-by-step-installation
captured_at: '2026-11-04T11:32:02+08:00'
---

### LoRa card installation

LtAP LTE kit will be used as an example in this section.

Open your router's case. For LtAP specifically, once you have removed all the screws, carefully move the upper case to the left side, as the LTE antennas are attached to the inner side of it:

![1.png](./img/step-by-step-installation-01-0dbffefc5d5624bf2a86772402b7fb9.webp)

Insert R11e-LoRa card into the mini-PCIe slot and apply two screws to the threaded inserts:

![](./img/step-by-step-installation-02-2dfdd8a3278530bd6a37963841d2de9.webp)

Attach antenna to the card (UFL connector). In this case UFL → SMA cable is also used, as the LtAP's case has a specific slot for it.

![](./img/step-by-step-installation-03-cbfa8f6a929894e52f85a6a3e282983.webp)

Once the previous steps are done, you can close the router's case and move on to configuration.

### Configuration

#### GUI setup

Connect to your router via Winbox or WebFig.

Winbox can be downloaded from the [link](https://mikrotik.com/download/winbox).

Run it:

![](./img/image-b7d80526.webp)

It is highly recommended to upgrade your RouterOS version to the latest available. Installing the version will perform a reboot:

![](./img/step-by-step-installation-05-17ab70d576a6a45fcdcd9899bb18714.webp)

If your device does not have the **IoT>LoRa** menu, download "**Extra packages**" specifically for your router's architecture and rOS version. You can see the type of your router's architecture at the top of the Winbox window or in System →  Resources → Architecture Name.
[https://mikrotik.com/download](https://mikrotik.com/download)
![](./img/step-by-step-installation-06-2f1d3a3434e87784135bdc5b4bca04b.webp)

Once the package is downloaded and extracted, upload the **IoT** package to your router. It can be done via drag & drop as well. It should appear in the files folder after the upload is complete. Reboot your router (System → Reboot) to install the package:
![](./img/step-by-step-installation-07-2ee48ac969ebff93c07bbfa95fa9110.webp)

After the reboot, the package should be visible in the Package list:
![](./img/step-by-step-installation-08-6c81dc0988ae9c3d2b5b294b85eb2b9.webp)

Check if the LoRa gateway has initialized under **IoT>LoRa>Devices**. If it is an LtAP model, make sure to set USB Type to Mini-PCIe:
![](./img/step-by-step-installation-09-7dc0ae65b3b7665a42d48a42764c7f7.webp)

Once the gateway has shown up (under **IoT>LoRa>Devices**), select it, choose Network Servers from the default ones or add your own (under **IoT>LoRa>Servers**) and enable it:
![](./img/step-by-step-installation-10-feefdb6ef82a331c07d2f40ea969387.webp)

Navigate to the Traffic tab to monitor the surrounding nodes sending requests:
![](./img/step-by-step-installation-11-98e9869dcfe521705062b37d93aa161.webp)

This concludes basic installation and configuration of LoRa mini-PCIe cards. For additional settings check: [General Properties](/docs/7.24/internet-of-things/lora/general-properties)
