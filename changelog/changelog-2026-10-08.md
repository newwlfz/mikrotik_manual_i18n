---
title: "Documentation updates - October 8, 2026"
date: 2026-10-08
slug: /changelog-2026-10-08
source: https://manual.mikrotik.com/changelog/changelog-2026-10-08
captured_at: '2026-11-04T06:08:59+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 8, 2026.

## Storage

- **[Btrfs RAID](/docs/7.24/storage/btrfs/raid)**: New "Expanding Btrfs-RAID" guide. Adding members with add-device registers each disk at its full size but moves no data until balance-start converts the profiles (a two-disk RAID1 becomes a four-disk RAID10 with twice the usable capacity).

## Management Tools

- **[CMR](https://manual.mikrotik.com/docs/management-tools/cmr)**: Pairing clarified: each pair command takes the username and password of the other device — the server's [/cmr/device/pair](https://manual.mikrotik.com/docs/cli-reference/cmr/device/pair) takes a user of the client, the client's [/cmr/client/pair](https://manual.mikrotik.com/docs/cli-reference/cmr/client/pair) a user of the server. Pairing can usually be completed from one console; only confirm forces action on the server console. New example pairs devices by their individual stock passwords: run /cmr/device/pair username=admin password=&lt;password from one box&gt; once per box, and use labels instead of all to limit a run to part of the fleet.

## Wireless

- **[Wi-Fi](/docs/7.24/wireless/wifi)**: The page now covers Wi-Fi HaLow (802.11ah) interfaces next to Wi-Fi 6/7. The Network section explains provisioning: labels default to all, each radio automatically gets labels such as 2ghz, 5ghz and 6ghz plus its MAC address, - negates a label, and extra-labels assigns more. New "Converting to/from network-managed Wi-Fi" section: the order RouterOS follows to pick a configuration (static entry, provisioning, network, disabled stub) and how to convert with provision and /interface/wifi/liberate. Radio capabilities now document every hw-caps value (channel-switch, hw-protection-mode, qos-classifier-dscp, sniffer, spectral), and the new "Radio settings" section covers /interface/wifi/radio/settings (default-country, external-antenna, wifi-band).
- **[Wi-Fi](/docs/7.24/wireless/wifi)**: Corrections in the same pass: warnings moved to the parameters they belong to (encryption ciphers, 802.11r roaming), distance and vlan-id descriptions clarified (HaLow and wifi-qcom-ac do not offload VLANs), and the spectral scan/history and WPS client examples fixed.
