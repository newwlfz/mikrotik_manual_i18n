---
sidebar_key: "getting-started/installation-and-upgrade/install/chr-installation/virtualbox"
sidebar_position: 7
title: "CHR: VirtualBox Installation"
sidebar_label: 'CHR: VirtualBox Installation'
description: 'This page provides a step-by-step guide for installing MikroTik RouterOS Cloud Hosted Router (CHR) in VirtualBox, covering VM creation, configuration, and initial setup with login instructions.'
tags:
  - 'virtualbox'
  - 'routeros-configuration'
  - 'network-adapters'
source: https://manual.mikrotik.com/docs/7.25/getting-started/installation-and-upgrade/install/chr-installation/virtualbox
captured_at: '2026-11-04T11:18:34+08:00'
---

## CHR VirtualBox Installation Video

**[![](/img/b1b6f1c2752c2ba1.png)](https://www.youtube.com/watch?v=oHXkaHkSVVo)**

1. **Download VirtualBox**  
   Install the latest version of VirtualBox from the official website.

2. **Download CHR disk image**  
   Download and extract the latest Long-Term, Stable, or Testing version of the Cloud Hosted Router (CHR) VDI image from the [MikroTik download page](https://mikrotik.com/download).

![](/img/b8bbe080282650df.png)

## Step 1: Create a New Virtual Machine

- Launch VirtualBox.
- Click **New** to create a new virtual machine.

![](/img/72af47c1e8a1a068.png)

### Name and Operating System

- **Name**: Enter a VM name (e.g., MikroTik_CHR)
- **Type**: Linux
- **Version**: Other Linux (64-bit)

![](/img/093f05cdebabf23f.png)

## Step 2: Configure Memory Size

- Allocate at least **512 MB RAM** (RouterOS 7 minimum requirement)
- Assign the desired number of CPUs

![](/img/4e95cf301fba533d.png)

## Step 3: Add a Virtual Hard Disk

- Select **Use an Existing Virtual Hard Disk File**
- Choose the downloaded `.vdi` image

![](/img/dd215579bb02c177.png)

Click **Finish** to create the VM.

## Step 4: Configure Virtual Machine Settings

Select the VM → click **Settings**

![](/img/0fc6a478e46dae13.png)

### System

- Disable **Floppy** and **Optical** from boot order

![](/img/10efb5ed4436b0bf.png)

### Processor

- Set the desired number of CPUs

### Network

- Adapter 1:
  - Enable network adapter
  - Attach to **Bridged Adapter** or **NAT** (depending on your setup)

![](/img/a9efaeab9a73ba15.png)

## Step 5: Start the Virtual Machine

- Click **Start** to boot the VM

![](/img/38b5dcfb21bfadc3.png)

- Login credentials:
  - Username: `admin`
  - Password: *(empty, set immediately after first login)*

![](/img/c90c90493a21cb3c.png)

## Congratulations

You have successfully installed MikroTik CHR on VirtualBox.

You can now proceed with initial RouterOS configuration using the console, WinBox, or WebFig.

## Supported Network and Disk Interfaces

### Network Adapters

- E1000
- RTL8139
- Virtio (paravirtual)

### Disk Controllers

- IDE

> **Warning:** Avoid using the E1000 network adapter unless no better synthetic or paravirtualized option is available. Virtio provides better performance on VirtualBox.
