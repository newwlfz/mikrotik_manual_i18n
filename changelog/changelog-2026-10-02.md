---
title: "Documentation updates - October 2, 2026"
date: 2026-10-02
slug: /changelog-2026-10-02
source: https://manual.mikrotik.com/changelog/changelog-2026-10-02
captured_at: '2026-11-04T06:08:56+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 2, 2026.

## Diagnostics & Monitoring

- **[Log](/docs/7.24/diagnostics-monitoring-and-troubleshooting/log)**: Rewritten and tested on RouterOS 7.25 against syslog, TLS and SMTP servers. Both property tables moved to the CLI Reference. Corrected: entries always show the full date, disk-lines-per-file defaults to 1000, TCP and TLS work with every format, and critical entries print once at the next login, not at every login. New sections:

- Read the log: filter by topic, message and time, follow-only, extra fields with with-extra-info, saving to a file, and finding out who changed the configuration.
- Log debug messages for one feature into its own memory buffer, with a warning that SSH debug messages contain session keys and session content.
- Keep the log across reboots with the disk action: file rotation, folders on other disks, and reading older files.
- Send the log to a syslog server: the default, syslog (RFC 3164) and cef formats, UDP, TCP and TLS, the TCP buffer, why to use CEF over TCP and TLS, and TLS with a trusted CA (check-certificate does not check the certificate name).
- Email log messages, and run a script on a log message (an example collects the source addresses of failed logins in an address list).
- How rules match entries (all listed topics must match, !, regex, prefix), the topic list, troubleshooting, and the wire format of each remote format.

- **[CEF with Elasticsearch](/docs/7.24/diagnostics-monitoring-and-troubleshooting/log/cef-with-elasticsearch)**, **[Syslog with Elasticsearch](/docs/7.24/diagnostics-monitoring-and-troubleshooting/log/syslog-with-elasticsearch)**: Fixed links to the reworked Log page and wrapped the RouterOS commands. The CEF guide no longer adds the same rules twice. Kibana and JSON blocks are no longer marked as RouterOS code.
- **[Bandwidth test](/docs/7.24/diagnostics-monitoring-and-troubleshooting/bandwidth-test)**: Rewritten and tested between a hAP ax², a CCR2116 and a 64-core server. Property tables moved to the CLI Reference. New sections:

- Prerequisites: the server, device mode on both routers, a test user with the test and winbox policies, firewall ports, and why UDP receive tests fail behind NAT.
- Test a link at a fixed rate, measure the maximum throughput, check a link for packet loss with UDP at a fixed rate, and test wireless directions one at a time.
- Read the results: UDP counts whole IP packets and TCP only the data; lost-packets counts the last second, not a total; the CPU load fields.
- Test a router's forwarding capacity through a chain of three routers, with packet sizes and when to use the traffic generator.
- Secure the server with allowed-addresses4 and allowed-addresses6 instead of turning authentication off; max-sessions counts tests.
- Troubleshooting by status, and the ports and connections in Technical details.

## CLI Reference

- **[/log](/docs/7.24/cli-reference/log)**, **[/system/logging](/docs/7.24/cli-reference/system/logging)**, **[/system/logging/action](/docs/7.24/cli-reference/system/logging/action)**, **[clear](/docs/7.24/cli-reference/system/logging/action/clear)**: Described every parameter. Defaults, ranges and behaviour were checked on a router. The topics row lists every topic. email-start-tls is described as unused: the email action follows the tls setting of /tool/e-mail.
- **[/tool/bandwidth-test](/docs/7.24/cli-reference/tool/bandwidth-test)**, **[/tool/bandwidth-server](/docs/7.24/cli-reference/tool/bandwidth-server)**, **[session](/docs/7.24/cli-reference/tool/bandwidth-server/session)**: Described every parameter and result field, for example defaults, the 52-byte minimum UDP size, the status values, and what max-sessions counts.
- **[/disk/btrfs/filesystem](/docs/7.24/cli-reference/disk/btrfs/filesystem)**, **[/disk/btrfs/subvolume](/docs/7.24/cli-reference/disk/btrfs/subvolume)**, **[/disk/btrfs/transfer](/docs/7.24/cli-reference/disk/btrfs/transfer)**: Filled the descriptions of the Btrfs commands and parameters.
- **[/disk](/docs/7.24/cli-reference/disk)**: Described the sshfs-address, sshfs-port, sshfs-user, sshfs-password, sshfs-path and sshfs-local-user parameters.
- **[/ip/smb](/docs/7.24/cli-reference/ip/smb)**, **[shares](/docs/7.24/cli-reference/ip/smb/shares)**, **[users](/docs/7.24/cli-reference/ip/smb/users)**: Filled the SMB server, share and user descriptions.
- **[/file/sync](/docs/7.24/cli-reference/file/sync)**, **[/file/rsync-daemon](/docs/7.24/cli-reference/file/rsync-daemon)**: Described the sync entries (mode, local-path, remote-path, user, flags) and the rsync daemon.

## Storage

- **[Storage package](/docs/7.24/storage)**: The section index now calls the package by its current name, Storage package (rose-storage in /system/package/print), instead of ROSE.
- **[Btrfs](/docs/7.24/storage/btrfs)**, **[Btrfs RAID](/docs/7.24/storage/btrfs/raid)**, **[Btrfs maintenance](/docs/7.24/storage/btrfs/maintenance)**, **[Btrfs snapshots](/docs/7.24/storage/btrfs/snapshots)**: Reworked. An overview of the three Btrfs menus, the default &lt;disk&gt;-fs file system label, and what add-device and the balance do when converting to RAID1. The RAID commands now find the file system by devs instead of present-devs. Version notes removed.
- **[SSHFS](https://manual.mikrotik.com/docs/storage/sshfs)**: New page. Mount a folder from an SSH server as a disk with /disk/add type=sshfs, with the mount states and how to change or remove the mount.
- **[SMB](/docs/7.24/storage/smb)**: The server, share and user property tables moved to the CLI Reference. The page explains that the server starts by itself when the first share is added.
- **[RAID](/docs/7.24/storage/raid)**, **[Hot spare](/docs/7.24/storage/raid/hot-spare)**, **[Moving an array](/docs/7.24/storage/raid/moving-array)**: The RAID property table moved to the CLI Reference, the examples became top-level sections, and the hot spare page explains how the spare is configured.
- **[Encrypted storage](/docs/7.24/storage/encrypted-storage)**, **[Self-encrypting drives](/docs/7.24/storage/self-encrypting-drives)**: Rewritten intros and examples, with the property tables removed. Encrypted storage on a RAID1 array. Self-encrypting drives need an Opal-compliant drive attached directly (not through a USB bridge), with the o and O flags explained.
- **[iSCSI](/docs/7.24/storage/iscsi)**, **[NFS](/docs/7.24/storage/nfs)**, **[NVMe over TCP](/docs/7.24/storage/nvme-over-tcp)**, **[Rsync](/docs/7.24/storage/rsync)**: Property tables removed, with improved intros and examples: the default ports (iSCSI TCP 3260, NFS TCP 2049, NVMe over TCP 4420), the default iSCSI IQN, and the NFS state when the port is blocked.

## Hardware

- **[PoE-Out](/docs/7.24/hardware/poe-out)**: Added the no_valid_psu, lldp-power-off, low-voltage-pd-detected and power-limiting values of poe-out-status.
