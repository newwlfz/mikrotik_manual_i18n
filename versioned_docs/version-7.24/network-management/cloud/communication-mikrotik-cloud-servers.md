---
sidebar_key: "network-management/cloud/communication-mikrotik-cloud-servers"
sidebar_position: 2
title: "Communication with MikroTik Cloud Services"
sidebar_label: 'Communication with MikroTik Cloud Services'
description: 'This page details MikroTik RouterOS connections to cloud servers and Mikrotik services, listing sub-menus, domain names, default statuses, and methods to disable communication for each connection type.'
tags:
  - 'cloud'
  - 'backup'
source: https://manual.mikrotik.com/docs/7.24/network-management/cloud/communication-mikrotik-cloud-servers
captured_at: '2026-11-04T11:32:29+08:00'
---

This table lists information about all connections that can occur from RouterOS to MikroTik servers, as well as instructions on how to disable such connections.

| Sub-menu | Domain name | Enabled/Active by default | Ensuring communication is disabled/inactive |
| :-- | :-- | :-- | :-- |
| **system clock time-zone-autodetect** | cloud2.mikrotik.com | Yes | `/system/clock/set` time-zone-autodetect=no ([See Clock Docs](/docs/7.24/system-information-and-utilities/clock)) |
| **system backup cloud** | cloud2.mikrotik.com | No | Communication is only invoked by upload-file, download-file, remove-file commands. ([See Backup](/docs/7.24/network-management/cloud/#cloud-backup)) |
| **ip cloud update-time** | cloud2.mikrotik.com | Yes | `/ip/cloud/set` update-time=no ([See Update Time](/docs/7.24/network-management/cloud/#update-time)) |
| **ip cloud ddns-enabled** | cloud2.mikrotik.com | No | `/ip/cloud/set` ddns-enabled=auto ([See DDNS](/docs/7.24/network-management/cloud/#ddns)) |
| **ip cloud back-to-home-vpn** | cloud2.mikrotik.com | No | `/ip/cloud/set` back-to-home-vpn=revoked-and-disabled ([See BTH VPN](/docs/7.24/network-management/cloud/back-to-home#ip-cloud)) |
| **ip cloud back-to-home-file** | cloud2.mikrotik.com | No | Communication is only invoked by enabling or disabling file sharing in "ip cloud back-to-home-file". ([See File Share](/docs/7.24/network-management/cloud/file-share)) |
| **system license** | licence.mikrotik.com | Yes (relevant only for [CHRs](/docs/7.24/getting-started/routeros-licensing/chr/)) | In the case of CHRs, it is impossible to disable communication with the license server using a specific command or setting in RouterOS. ([See CHR License](/docs/7.24/getting-started/routeros-licensing/chr/chr-licensing)) |
| **interface lte firmware-upgrade** | upgrade.mikrotik.com | No | Communication is only invoked by the firmware-upgrade command. ([See LTE Firmware Upgrade](/docs/7.24/mobile-networking/lte-5g#modem-firmware-upgrade-command)) |
| **interface detect-internet** | cloud.mikrotik.com | No | `/interface/detect-internet/set` detect-interface-list=none ([See Detect Internet](/docs/7.24/diagnostics-monitoring-and-troubleshooting/detect-internet)) |
| **system package update** | upgrade.mikrotik.com | No | Communication is only initiated by the check-for-updates command and by downloading packages from the upgrade server. ([See Package Updates](/docs/7.24/getting-started/installation-and-upgrade/packages)) |
| **system swos upgrade** | upgrade.mikrotik.com | No | Communication is only invoked by the upgrade command. ([See SWOS Upgrade](/docs/7.24/bridging-and-switching/marvell-prestera-switch-chip-features#configuring-swos-using-routeros)) |
