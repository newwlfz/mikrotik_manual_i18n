---
sidebar_key: "network-management/cloud/communication-mikrotik-cloud-servers"
sidebar_position: 3
title: "Communication with MikroTik Cloud Services"
sidebar_label: 'Communication with MikroTik Cloud Services'
description: 'Every connection RouterOS makes to MikroTik servers: the menu that starts it, the server, whether it runs by default, and how to turn it off.'
tags:
  - 'cloud'
  - 'backup'
source: https://manual.mikrotik.com/docs/network-management/cloud/communication-mikrotik-cloud-servers
captured_at: '2026-11-09T11:35:47.715Z'
---

RouterOS connects to MikroTik servers only for the services in the following table. By default, the router asks the cloud server for the time and time zone when it starts, and a Cloud Hosted Router (CHR) checks its license. Everything else runs only after you enable it or run the command.

| Menu | Server | On by default | How to turn it off |
| :-- | :-- | :-- | :-- |
| `/system/clock` `time-zone-autodetect` | `cloud2.mikrotik.com` | Yes | `/system/clock/set time-zone-autodetect=no` (see [Clock](/docs/system-information-and-utilities/clock)) |
| `/ip/cloud` `update-time` | `cloud2.mikrotik.com` | Yes | `/ip/cloud/set update-time=no` (see [Time update](/docs/network-management/cloud/#time-update)) |
| `/ip/cloud` `ddns-enabled` | `cloud2.mikrotik.com` | No | `/ip/cloud/set ddns-enabled=auto`, with Back To Home off (see [DDNS](/docs/network-management/cloud/#ddns)) |
| `/ip/cloud` `back-to-home-vpn` | `cloud2.mikrotik.com` and relay servers | No | `/ip/cloud/set back-to-home-vpn=revoked-and-disabled` (see [Back To Home](/docs/network-management/cloud/back-to-home)) |
| `/ip/cloud/back-to-home-file` | `cloud2.mikrotik.com` and relay servers | No | Remove all file shares (see [File Share](/docs/network-management/cloud/file-share)) |
| `/system/backup/cloud` | `cloud2.mikrotik.com` | No | Runs only for the `print`, `upload-file`, `download-file` and `remove-file` commands (see [Cloud backup](/docs/network-management/cloud/cloud-backup)) |
| `/system/license` | `licence.mikrotik.com` | Only on CHR | Cannot be turned off on CHR (see [CHR licensing](/docs/getting-started/routeros-licensing/chr/chr-licensing)) |
| `/interface/lte` `firmware-upgrade` | `upgrade.mikrotik.com` | No | Runs only for the `firmware-upgrade` command (see [LTE firmware upgrade](/docs/mobile-networking/lte-5g#modem-firmware-upgrade-command)) |
| `/interface/detect-internet` | `cloud.mikrotik.com` | No | `/interface/detect-internet/set detect-interface-list=none` (see [Detect Internet](/docs/diagnostics-monitoring-and-troubleshooting/detect-internet)) |
| `/system/package/update` | `upgrade.mikrotik.com` | No | Runs only for the `check-for-updates` command and package downloads (see [Packages](/docs/getting-started/installation-and-upgrade/packages)) |
| `/system/swos` `upgrade` | `upgrade.mikrotik.com` | No | Runs only for the `upgrade` command (see [SwOS upgrade](/docs/bridging-and-switching/marvell-prestera-switch-chip-features#configuring-swos-using-routeros)) |

## Technical details

The router uses the following ports:

- `cloud2.mikrotik.com`: UDP port 15252 for DDNS and TCP port 15252 for cloud backup. The name resolves to more than one address, and the router tries another one when a server does not answer.
- `cloud.mikrotik.com`: UDP port 30000 for Detect Internet.
