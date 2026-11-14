---
title: "Documentation updates - October 6, 2026"
date: 2026-10-06
slug: /changelog-2026-10-06
source: https://manual.mikrotik.com/changelog/changelog-2026-10-06
captured_at: '2026-11-04T06:09:01+08:00'
tags:
  - label: "Documentation changelog"
    permalink: changelog
---

Summary of documentation changes made on October 6, 2026.

## Management Tools

- **[CMR](/docs/management-tools/cmr)**: The Alert rules section now separates state alerts from event alerts, with a table that compares them:

- A state alert (CPU, memory, disk, and health thresholds, connected, disconnected-more-than, upgrade-available) stays active while all its conditions match. It runs its actions once when it becomes active and counts in devices-on and the dashboard until it clears.
- An event alert (interface-change, upgrade-done, upgrade-job-done, rebooted, unpaired-device-connected, or a log message matched by log-topics and log-regex) runs its actions for every occurrence and never stays active. A rule can combine several state conditions but has at most one event condition.
- A new Device and system scope section: most alerts apply per device, and upgrade-job-done is a system alert that reports a whole upgrade job without device context.
- show-devices lists the devices on which a rule's state alert is active. It lists no devices for an event alert, whose fired value counts the occurrences instead.

- **[CMR](/docs/management-tools/cmr)**, **[CMR-Client](/docs/management-tools/cmr/client)**: Corrections to connecting and pairing clients:

- Clients connect to the server over TCP port 54321. Allow it in the server's input chain and in any firewall between the clients and the server. The client troubleshooting for status: searching now points to the port and the firewalls.
- The client's pairing-requirement supports none and password. confirm exists only on the server, where /cmr/device/pair approves the pairing. The client-side confirm case is gone from the troubleshooting list.

- **[CMR](/docs/management-tools/cmr)**, **[CMR-Client](/docs/management-tools/cmr/client)**: Details of upgrades, reboots and alerts:

- /cmr/device/upgrade without channel upgrades each device on its own upgrade channel, and with schedule-time the job waits for the next occurrence of that time. A job it starts for devices selected by number has no labels, and run-next starts a job scheduled this way itself.
- Removing a scheduled job marks it cancelled and keeps it in the list. Removing a cancelled job deletes it.
- The server's log messages for device upgrade results, newly available versions and reboots are listed. reboot returns right away.
- Alert variables: [state] is empty for a paired device with nothing in progress, the usage values are unknown until the device reports them, [upgrade-error] is empty after a successful upgrade, [upgrade-state] is the final state of the device in the job, and the job times have the form 2026.10.06-14:20:36.
- When CMR restarts on the server, state alerts that still match become active again and run their actions.
- The REST API returns the WiFi passphrase to users with the sensitive policy.
- The client logs each change of its status and reconnects with its existing pairing when the connection to the server drops.

- **[CMR](/docs/management-tools/cmr)**, **[CMR-Client](/docs/management-tools/cmr/client)**: Defaults and server settings:

- fail-policy defaults to stop, and stop with strategy=parallel no longer needs order. Only continue-order requires it.
- upgrade-check-interval defaults to 10h. apptraffic-devices defaults to the gateway label, and all selects every device.
- The client's pairing-requirement defaults to password.
- Clients find the server through neighbor discovery or DNS: the client resolves _cmr._tcp.lan and _cmr._tcp. followed by the domain name from DHCP option 15. DHCP alone does not announce the server.
- /cmr set !&lt;setting&gt; returns a setting to its default. Changing packages-directory, upgrade-check-interval, or pairing-requirement restarts CMR on the server, so every client reconnects and state alerts fire again.
- Changing an enabled alert rule, even only its comment, makes its state alert fire again on the devices that match.
- In the links value of a layout link, a * before a port name marks a direct, physical link. It does not mark the PoE supplier.

- **[CMR](/docs/management-tools/cmr)**: Node coordinates are relative to the layout center: x increases to the right and y downward, so a smaller y places a node higher on the map.
- **[SSH](/docs/management-tools/ssh)**: The page is reorganized around the SSH server, the interactive client, and scripted use. A new "Verify remote host keys" section explains the known-hosts-validation setting (enabled on new installations, kept as-is on upgrades), the interactive trust and key-update prompts of /system/ssh, and the ways to make ssh-exec and SFTP fetch work with validation on: pinning keys in /ip/ssh/known-hosts, known-hosts-ignore, or known-hosts-trusted-subnets. The "Server host key" section documents the fingerprint, regeneration, and the export file names. Importing a client-side private key now lists the accepted PEM formats and notes that OpenSSH private keys are rejected. The ssh-exec example no longer contains a plain-text password and states its prerequisites.

## CLI Reference

- **[/cmr/alert](/docs/cli-reference/ip/dhcp-server/alert/)**, **[show-devices](/docs/cli-reference/cmr/alert/show-devices)**: Descriptions follow the state and event split. connected is a state condition, rebooted and the log conditions are event conditions, devices-on counts only active state alerts, and reset-on-disconnect applies to state alerts. show-devices lists the devices on which the rule's state alert is active.
- **[/cmr](/docs/cli-reference/cmr)**: pairing-requirement=password takes the username and password of a RouterOS user on the device, as in the [CMR](/docs/management-tools/cmr#pairing) guide. CMR has no separate pairing password.
- **[/cmr/device/upgrade](/docs/cli-reference/cmr/device/upgrade)**, **[reboot](/docs/cli-reference/system/reboot)**, **[/cmr/upgrade/job](/docs/cli-reference/system/script/job)**, **[run-next](/docs/cli-reference/cmr/upgrade/job/run-next)**: Descriptions of the channel and schedule-time of a device upgrade, the empty labels and channel of its job, run-next for a job scheduled this way, and the log message after a reboot.
- **[/cmr](/docs/cli-reference/cmr)**, **[/cmr/client](/docs/cli-reference/cmr/client)**, **[/cmr/upgrade](/docs/cli-reference/cmr/upgrade)**, **[/cmr/device/upgrade](/docs/cli-reference/cmr/device/upgrade)**, **[/cmr/layout/link](/docs/cli-reference/cmr/layout/link)**: Defaults for upgrade-check-interval, apptraffic-devices, fail-policy and the client's pairing-requirement, DNS discovery in controller-addresses, order required only for continue-order, and the * in links.
- **[/cmr/client](/docs/cli-reference/cmr/client)**, **[/tool/apptraffic](/docs/cli-reference/tool/apptraffic)**, **[/system/routerboard/usb](/docs/cli-reference/system/routerboard/usb/)**: The MIPS-LE architecture (mipsel), which has no RouterOS 7 release, is no longer listed in the conditions of these pages or in the application traffic note of the [CMR](/docs/management-tools/cmr#application-traffic) guide. The /system/routerboard/settings/keep-frequency page is removed: the command exists only on MIPS-LE devices.
- **[/ip/ssh](/docs/cli-reference/ip/ssh/)**, **[known-hosts](/docs/cli-reference/ip/ssh/known-hosts)**, **[/system/ssh](/docs/cli-reference/system/ssh)**, **[/system/ssh-exec](/docs/cli-reference/system/ssh-exec)**: All parameter descriptions are filled in, including the host-key validation settings and the previously undocumented host, key, port and vrf parameters. ssh-exec now documents what its exit-code and output carry on remote command failure.
- **[/interface/wifi/radio](/docs/cli-reference/interface/wifi/radio/)**: References to the unreleased "meshpoint" mode are removed.
- **[/ip/dns/adlist](/docs/cli-reference/ip/dns/adlist/)**, **[DNS](/docs/network-management/dns)**: Disabling an adlist does not free its cache memory.

## Mobile Networking

- **[LTE/5G](/docs/mobile-networking/lte-5g)**: New "Multi APN" section: check max-apn-count with show-capabilities, create a slave LTE interface with master= for each additional APN connection, and the interface's apn-profiles parameter is renamed to apn-profile (the old name is still accepted for single-APN configuration).

## Firewall & QoS

- **[Packet Flow](/docs/firewall-and-quality-of-service/packet-flow-in-routeros)**: The packet flow diagram is updated.

## Hardware

- **[CRS310-8G+2S+IN](/hardware/crs310-8g-plus-2s-plus-in)**: The reset button section lists its three functions. A configuration reset now waits for the PWR LED to flash instead of the USR LED, and Netinstall describes both the Regular Booter (press Reset 1–2 seconds after power-on) and the Backup Booter (hold Reset while powering on until the LED blinks, turns steady, and goes off).
