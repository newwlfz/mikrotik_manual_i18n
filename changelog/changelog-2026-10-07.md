---
title: "Documentation updates - October 7, 2026"
date: 2026-10-07
slug: /changelog-2026-10-07
source: https://manual.mikrotik.com/changelog/changelog-2026-10-07
captured_at: '2026-11-04T06:08:58+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 7, 2026.

## Management Tools

- **[SSH](/docs/management-tools/ssh)**, **[ssh-exec](/docs/cli-reference/system/ssh-exec)**: Execution details verified on the lab router: multiline remote commands are executed on RouterOS 7.25 and later (the SSH server still does not provide pseudo-tty). exit-code is the code reported by the remote command shell, while failures of RouterOS commands come back as error text in output. The ssh-exec example was corrected to read the link status with monitor ... once as-value.
- **[CMR](https://manual.mikrotik.com/docs/management-tools/cmr)**: New "run-script permissions" section: scripts sent with /cmr/device/run-script run on each client with the read, write, test and reboot policies, without a user session. Commands that need other policies fail with "not enough permissions (9)" — for example /user add needs policy and /tool sniffer needs sniff, so /export also fails. Sensitive values are masked as * but can be set. Scripts and scheduler entries created by run-script are saved with the same four policies and the *sys owner, and a wider policy is reduced back to the four.

## Wireless

- **[Wi-Fi](/docs/wireless/wifi)**: The authentication-types list now includes wpa3-psk-gd, and the default value description was rewritten: with a passphrase configured, the default set depends on the WiFi standard, band and mode — 6-7 GHz APs default to WPA3-PSK and GD, WiFi 7 APs in 2.4/5 GHz to WPA2/WPA3-PSK and GD, WiFi 5/6 APs to WPA2-PSK and stations to WPA/WPA2-PSK.

## Hardware

- **[PoE](/docs/hardware/poe-out)**: Global settings and monitoring tables synced with the CLI reference: added poe-in-max-power, the jack-max-power and 2pin-max-power variants, the per-power-source poe-out-max-power rows and the read-only PoE controller firmware version. Monitoring gained the port-type and poe-voltage fields, a refreshed poe-out-status list (no-valid-PSU, lldp-power-off, low-voltage-pd-detected and more) and a note about the "power-limiting port" status on devices powered via PoE-In.
