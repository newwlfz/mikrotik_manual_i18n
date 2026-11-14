---
title: "L14G-2ax-BT5-HL9&EG800Q (KNOT Gateway HL9)"
slug: /l14g-2ax-bt5-hl9-and-eg800q
source: https://manual.mikrotik.com/hardware/l14g-2ax-bt5-hl9-and-eg800q
captured_at: '2026-11-04T09:53:05+08:00'
---

This guide can be downloaded as a <a href="/assets/files/l14g-2ax-bt5-hl9-and-eg800q-87762c8938cbe57a3dcfaa63cee67b53.pdf" target="_blank" rel="noopener">PDF file</a>.

![](/img/f9479f22ec666562.webp)

![](/img/cb9a99a1b9413676.webp)

## [KNOT Gateway HL9](https://mikrotik.com/product/knot_gateway_hl) (L14G-2ax-BT5-HL9&EG800Q)

A rugged IP66 IoT gateway combining BLE 5.1, 915 MHz Wi-Fi HaLow, Wi-Fi, Gigabit Ethernet, LTE Cat 1 bis, and GNSS. See the [KNOT Gateway HL9 product page](https://mikrotik.com/product/knot_gateway_hl) for full specifications and brochures.

## Safety Warnings

- Before you work on any equipment, be aware of the hazards involved with electrical circuitry, and be familiar with standard practices for preventing accidents.
- Ultimate disposal of this product should be handled according to all national laws and regulations.
- The Installation of the equipment must comply with local and national electrical codes.
- This product is intended to be installed outdoors, on a wall or pole. Please read the mounting instructions carefully before beginning installation. Failure to use the correct hardware or to follow the correct procedures could result in a hazardous situation for people and damage to the system.
- Use only the power supply and accessories approved by the manufacturer, and which can be found in the original packaging of this product.
- Read the installation instructions before connecting the system to the power source.
- We cannot guarantee that no accidents or damage will occur due to the improper use of the device. Please use this product with care and operate at your own risk!
- In the case of device failure, please disconnect it from power. The fastest way to do so is by unplugging the power plug from the power outlet.
- It is the customer's responsibility to follow local country regulations, including operation within legal frequency channels, output power, cabling requirements, and Dynamic Frequency Selection (DFS) requirements. All MikroTik radio devices must be professionally installed.

**Exposure to Radio Frequency Radiation:** This MikroTik equipment complies with the FCC, IC, and European Union radiation exposure limits set forth for an uncontrolled environment. This MikroTik device should be installed and operated no closer than 20 centimeters from your body, occupational user, or the general public.

## Specifications

<table><thead><tr><th>Parameters</th><th>Description</th></tr></thead><tbody><tr><td>**Product Code**</td><td>L14G-2ax-BT5-HL9&EG800Q</td></tr><tr><td>**Architecture**</td><td>ARM 64-bit</td></tr><tr><td>**CPU**</td><td>IPQ-5010, 2 core, 800 MHz</td></tr><tr><td>**RAM / Storage**</td><td>256 MB RAM / 128 MB NAND</td></tr><tr><td>**OS**</td><td>RouterOS v7, License Level 4</td></tr><tr><td>**Mobile: LTE**</td><td>Category 1 bis (10 Mbps ↓ / 5 Mbps ↑)</td></tr><tr><td>**MIMO**</td><td>DL 1×1, UL 1×1</td></tr><tr><td>**LTE FDD Bands**</td><td>2 (1900 MHz), 4 (1700 MHz), 5 (850 MHz), 12 (700 MHz), 13 (700 MHz), 66 (1700 MHz)</td></tr><tr><td>**TAC**</td><td>01688100</td></tr><tr><td>**Wireless**</td><td>2.4 GHz 802.11b/g/n/ax, Wi-Fi 6, 1 chain, 287 Mbit/s, 3.9 dBi</td></tr><tr><td>**Wi-Fi HaLow**</td><td>915 MHz</td></tr><tr><td>**Bluetooth**</td><td>5.1</td></tr><tr><td>**Ethernet**</td><td>1 × 1 GbE RJ45 (PoE-in 802.3af/at, 18-57 V)</td></tr><tr><td>**SIM**</td><td>1 × Nano-SIM & eSIM</td></tr><tr><td>**Power**</td><td>PoE-in (18-57 V) or 2-pin terminal (12-57 V), max 7 W</td></tr><tr><td>**Cooling**</td><td>Passive</td></tr><tr><td>**Dimensions**</td><td>254 × 88 × 57 mm</td></tr><tr><td>**Operating Temp.**</td><td>–40 °C … +50 °C</td></tr><tr><td>**MTBF**</td><td>Approximately 200,000 hours at 25 °C</td></tr><tr><td>**Certification**</td><td>FCC, IC, EAC</td></tr><tr><td>**IP**</td><td>IP66</td></tr></tbody></table>

## Quickstart

- Ensure your Internet Service Provider (ISP) allows hardware changes and automatically assigns an IP address;
- Connect the ISP cable to the Ethernet1 port;
- Connect the device to the power source;
- Connect to the device through any of the ports, excluding Ethernet1, or the wireless network "MikroTik-..." (check the wireless passwords on the sticker);
- Establish a connection using a mobile application. Alternatively, use **WebFig** in a web browser or the **WinBox** configuration tool at [https://mt.lv/winbox](https://mt.lv/winbox). **Multiple configuration methods are available to ensure accessibility;**
- Start configuration within the chosen tool, using the default IP address 192.168.88.1. If the IP address is unavailable, use **WinBox** and choose the "**Neighbors**" tab to find the device;
- Proceed to connect using the MAC address. The username is "**admin**", and there is no password (or, for some models, check user and wireless passwords on the sticker);
- Click the "Check for updates" button and update RouterOS to the latest version;
- For a manual update of the device, visit mikrotik.com, select your model, and locate the required packages in the "Downloads" section;
- Upload downloaded packages to the **WebFig** or **WinBox** "**Files**" menu and reboot the device;
- By upgrading your RouterOS software to the latest version, you can ensure optimal performance, stability, and security updates;
- In the Quick Set, WISP AP menu, choose your country to apply country regulation settings;
- Set up your wireless network password;
- Set up your router password.

## Mounting

The device is designed for outdoor use and can be mounted on either a wall or a pole.

### To mount the device on the wall

- Drill 6 mm holes corresponding to the mounting points on the back of the device, including additional holes for the security/locking points;
- Insert screws into the anchors, leaving approximately 10 mm of the screw heads exposed;

![](/img/f6d85d25026306b6.png)

- Position the device and align it with the mounting points;

![](/img/b60aa64414031dce.png)

- Secure the device to the wall by tightening the screws.

![](/img/553b3983a5a2daf1.png)

![](/img/88b12c8ab64bceb3.png)

### To mount the device on a pole

- Insert the hose clamps through the holes in the mounting brackets;
- Position the device against the pole and wrap the clamps around the pole;
- Tighten the clamps to secure the device firmly in place.

![](/img/1090de71679314c2.png)

:::warning warning

This equipment should be installed and operated with a minimum distance of 20 cm between the device and your body. The operation of this equipment in the residential environment could cause radio interference.

Mounting and configuration of this device should be done by a qualified person.

:::

## Powering

- 2-pin terminal accepts 12-57 V DC⎓;
- Ethernet port accepts 802.3af/at Power over Ethernet 18-57 V DC.

The maximum power consumption can reach up to 7 W.

### Connecting to a PoE Adapter

- Connect an Ethernet cable from the device to the **PoE + DATA** port of the PoE adapter;
- Connect an Ethernet cable from your local network (LAN) to the **DATA** port of the PoE adapter;
- Connect the power cord to the adapter, then plug it into a power outlet.

## Cellular modem configuration

Sub-menu: /interface lte

For band selection, roaming, or advanced options, please refer to the [LTE/5G manual](/docs/mobile-networking/lte-5g).

## Reset button

The reset button has three functions:

- Hold this button during boot time until the green LED light starts flashing, release the button to reset RouterOS configuration.
- Keep holding the reset button until the LED turns solid, then release it to enable CAP mode. The device will then start searching for a CAPsMAN server.
- To reinstall RouterOS using the [Netinstall](/docs/getting-started/installation-and-upgrade/netinstall/) utility, enter the device into BOOTP mode. Two booter options are available: the **Regular Booter** and the **Backup Booter**. It is recommended to verify both options in case one does not work.

- **Regular Booter:** To enter etherboot mode, press the **Reset** button after powering on the device and waiting 1–2 seconds.
- **Backup Booter:** Power off the device. Press and hold the **Reset** button, then power on the device. Wait for the **LED** sequence (blinking → steady → off), then release the button. The device will boot into **BOOTP** mode, ready for RouterOS reinstallation via **Netinstall**.

Regardless of the above option used, the system will load the backup RouterBOOT loader if the button is pressed before power is applied to the device. Useful for RouterBOOT debugging and recovery.

## Accessories

The package includes the following accessories that come with the device:

- KNOT Gateway HL9.
- 24 V, 0.5 A power adapter.
- Gigabit PoE injector.
- K-66 fastening set.
- Hose clamp (2 pcs).

## Operating system support

The device supports RouterOS v7 and above. The specific factory-installed version is listed in /system resource. Other operating systems have not been tested.
