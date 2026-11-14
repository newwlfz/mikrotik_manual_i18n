---
sidebar_key: "bridging-and-switching/swos/crs3"
sidebar_position: 1
title: "CRS3xx and CSS3xx Series Manual"
sidebar_label: 'CRS3xx and CSS3xx Series Manual'
source: https://manual.mikrotik.com/docs/bridging-and-switching/swos/crs3
captured_at: '2026-11-09T11:35:47.715Z'
---

## Summary

SwOS is an operating system designed specifically for the administration of MikroTik switch products. It provides fundamental managed switch functionalities alongside advanced features such as port-to-port forwarding, broadcast storm control, MAC/IP/port filtering via ACL rules, VLAN configuration, traffic mirroring, and bandwidth limitation.

SwOS is managed exclusively through a web browser (HTTP) over IPv4. Console access, SSH, API, or other management interfaces are not supported.

---

## Connecting to the Switch

Open a web browser and enter the default management IP address.

![Swos login css326](/img/6264ffe6828480e0.webp)

* **Default IP Address**: `192.168.88.1`
* **Default Username**: `admin`
* **Default Password**: *(blank)*

---

## System Tab

The System tab manages general configuration parameters, device discovery options, and administrative security.

![Swos system css326](/img/704f07a7a77e557f.webp)

### System Management Settings

| Property | Description |
| :--- | :--- |
| **Address Acquisition** | Specify which address acquisition method to use:<br/><code>DHCP with fallback</code> - the switch sends DHCP requests every second and, while no DHCP server is answering, immediately uses the configured <strong>Static IP Address</strong> value. When a server answers, the switch obtains a lease in 1-2 seconds and renews it at half the lease time. If a renewal goes unanswered, the switch returns to the <strong>Static IP Address</strong> value in 5 seconds and resumes sending requests every second.<br/><code>static</code> - address is set as a <strong>Static IP Address</strong> value (IPv4 only)<br/><code>DHCP only</code> - switch uses DHCPv4 client to acquire address |
| **Static IP Address** | Specifies the static IPv4 address for management access. |
| **Identity** | Sets a customizable name for the switch identifier. |
| **Allow From** | Restricts management web access to specified IP ranges or subnets. |
| **Allow From Ports** | Limits web access to designated physical switch interfaces. |
| **Allow From VLAN** | Restricts access to a specific incoming VLAN ID profile. |

![SwOS Management](/img/ca29c618018d3a59.webp)

### DHCP & PPPoE Snooping

SwOS features built-in security mechanics to block unauthorized or rogue DHCP servers and PPPoE discovery sequences on specified untrusted interfaces.

![CSS326 DHCP Snooping](/img/0f3d52a9da17fa79.webp)

### Configuration Security and Maintenance

The lower section handles backups and administrative passwords.

![Swos system3 css326](/img/3ba4a76afdcc03bc.webp)

* **Change Password**: Updates the device access keys.
* **Backup Configuration**: Saves current settings to a local file.
* **Restore Configuration**: Uploads and applies existing configuration states.

---

## Link Tab

The Link tab configures physical link parameters and monitors active connection properties for each interface.

![Swos link css326](/img/8dec2ad5f0c9b5e2.webp)

* **Link Profiles**: Manage interface states, toggle speed/duplex auto-negotiation, and control flow control pause frames.

---

## PoE Tab

*(Available on devices supporting Power over Ethernet distribution features)*

![SwOS PoE](/img/ca06196fd522c5cd.webp)

* Supports configuring power delivery settings (`auto`, `on`, `off`) and establishing port prioritization during power constraint events.

---

## SFP Tab

Provides visual diagnostics for connected SFP/SFP+ optical transceivers.

![Swos sfp1 css326](/img/d2e58a862ecccc20.webp)

* Monitors internal diagnostics such as operating temperatures, laser supply voltages, TX/RX power levels, and hardware serialization strings.

---

## Forwarding and Port Isolation

Manages Layer 2 packet-forwarding tables across the switching architecture.

![Swos forw css326](/img/cfc3bfc9dda03800.webp)
![Swos ivl system](/img/b0001fc2ceb3b1a6.webp)

### Port Isolation and Isolated Groups

Port isolation splits broadcast domains internally, controlling client communications without adding subnet layers.

![SwOS Isolated Groups](/img/284614f24611b0f4.webp)
![SwO isolation example3](/img/de28135343d9795b.webp)

---

## LAG (Link Aggregation)

Bundles physical interfaces into single high-throughput channels using either dynamic LACP links or static arrays.

![Swos lag css326](/img/42eb242aaffa0ae3.webp)

---

## RSTP (Rapid Spanning Tree Protocol)

Provides loop avoidance architectures and structural redundancy parameters.

![Swos rstp css326](/img/6e7df850ef26634b.webp)

* Supports configuring custom bridge path costs utilizing classic short or modern long path evaluation structures.

---

## VLAN & VLANs Matrix Configuration

VLAN routing rules split ingress packet sorting behavior from egress formatting tables.

### VLAN Tab (Ingress Control)

Handles port behaviors for incoming traffic streams.

![Swos vlan css326](/img/871181dce551f5b8.webp)

* **VLAN Modes**: Configures entry constraints across `disabled`, `optional`, `enabled`, and `strict` modes.

![Swos strict vlans](/img/d34e6c2d13d78d19.webp)

* **Default VLAN ID**: Sets the Port VLAN ID (PVID) assigned to incoming untagged traffic.

![Default vlan id](/img/1d9f62b52b3efa1f.webp)

### VLANs Tab (Egress Mapping)

Defines broadcast memberships and handling across target trunk ports.

![Swos vlans css326](/img/9d38b9ee9d82a8c1.webp)
![Swos vlans menu](/img/e5c63db80488b834.webp)

#### Traditional Mode Templates

* **Access Interfaces**: Pairs standard untagged endpoints to specific target VLAN tags.

  ![Access ports](/img/dcbdce357964f958.webp)

* **Trunk and Hybrid Options**: Blends multiple tagged streams with optional untagged native routing paths across primary core uplinks.

  ![Hybrid ports](/img/90b987271e134d95.webp)
  ![Swos hybrid](/img/2fb81eda61c231cd.webp)
  ![Swos hybrid vlan](/img/330b019789c2b24b.webp)

---

## Private VLANs

Enforces secure structural port communication profiles across shared infrastructure spaces.

![SwOS Private VLAN](/img/606fbb63c2620b62.webp)

---

## Hosts Tab

Exposes the active hardware Forwarding Database (FDB) dynamic entries discovered via incoming source addresses.

![Swos shost css326](/img/24da5f09ba887bf8.webp)

---

## IGMP Snooping

Filters multicast distributions, tracking active group subscriptions to block multicast flooding.

![IGMP snooping](/img/a5464dca06492640.webp)
![CSSxx IGMP](/img/8404b127eb3f6c84.webp)
![IGMP vlantab](/img/2c8b3d4fcf937b4d.webp)

---

## SNMP Tab

Enables monitoring via standard SNMP structures.

![Swos snmp2 1](/img/f3b87569bbcad587.webp)

---

## ACL Tab (Access Control Lists)

Executes hardware-offloaded filtering rules matching patterns across L2/L3/L4 frame headers to drop or redirect packets.

![CRS326 ACL table](/img/7e4fb4e7daa01ec1.webp)

---

## Diagnostics: Stats, Errors, and Histograms

Tracks interface counters, dropped frames, error patterns, and detailed structural link history diagnostics.

![Swos stat1 css326](/img/bc002e2ae29c54ca.webp)
![Swos stat2 css326](/img/a1256a0deac7e870.webp)
![Swos stat3 css326](/img/4dc5d6afd153aab3.webp)

---

## Health Tab

Monitors hardware operating environments, tracking system core temperatures and operating input voltages.

![SwOS CRS328 health](/img/c32f28c61507fb8f.webp)

---

## Dual Boot Operation

Many CRS hardware units support a dual-boot design, allowing toggle operations between running RouterOS or SwOS.

![Router board settings](/img/206e2364a9ea20ec.webp)
![Router board settings webfig](/img/e5f83f41c903b22e.webp)
![Dual boot option](/img/59c51ae05cc7ea21.webp)

Swapping operating systems toward SwOS using the RouterOS CLI interface utilizes the following system command structure:

```bash
/system routerboard settings set boot-os=swos
```

## Reset and Reinstall

It is possible to reset SwOS configuration using the "Reset Configuration" button in the System menu. In case SwOS web management is not available, the configuration can still be reset using other options.

The CSS326-24G-2S+ and CSS318-16G-2S+IN devices have built-in backup SwOS firmware which can be loaded in case standard firmware breaks or upgrade fails:

* Holding Reset button for few seconds while CSS326-24G-2S+ and CSS318-16G-2S+IN is booting resets configuration and loads backup firmware.
* After loading backup firmware, it is possible to connect to 192.168.88.1 (or leased address from a DHCP server) using web browser and install new SwOS firmware.

The Dual Boot devices can boot RouterOS using a reset button. Power the device while holding the reset button and wait till user LED starts flashing (around 5 seconds). This will reset the RouterOS configuration and the device will now boot into RouterOS. After device is accessible by RouterOS, it is possible to upgrade and reset SwOS configuration. See the article - Configuring SwOS using RouterOS.

CRS3xx devices with a serial console have additional options.

To change between RouterOS and SwOS follow these steps:

1. Connect to the device using a serial console
2. Enter RouterBOOT setup
3. Choose "j - boot os"
4. Choose either RouterOS or SwOS

It is possible to load a SwOS backup firmware in case standard firmware breaks or upgrade fails:

1. Connect to the device using a serial console
2. Boot SwOS
3. Choose "p - boot primary SwOS"
4. After loading backup firmware, it is possible to connect to 192.168.88.1 (or leased address from a DHCP server) using a web browser and install new SwOS firmware.

To reset SwOS configuration:

1. Connect to the device using a serial console
2. Boot SwOS
3. Choose "r - reset configuration"

![Swos reset](/img/88b172351cb761c2.webp)
