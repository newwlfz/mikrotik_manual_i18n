---
sidebar_key: "wireless/w60g/fail-over-ptp-gui-example"
sidebar_position: 4
title: "Fail-over PtP GUI example"
description: 'This guide demonstrates configuring automatic failover between a 60GHz wireless bridge and a bonded 5GHz interface using MikroTik RouterOS GUI, including bridge setup, wireless mode selection, and security profile...'
source: https://manual.mikrotik.com/docs/7.24/wireless/w60g/fail-over-ptp-gui-example
captured_at: '2026-11-04T11:36:18+08:00'
---

### Summary

This example shows how to configure an automatic fail-over (bonding) 5Ghz link in combination with 60Ghz devices in the GUI.  
When a connection between 60Ghz wireless is lost, it will automatically use the bonded interface.  
The example is done from empty configuration state with [[WinBox](https://mikrotik.com/download)] utility

### Connect to the device

After configuration reset - only mac-telnet is possible. In the main WinBox screen press on Neighbours, choose your device's MAC address and press Connect:

1. Select the correct device **MAC Address.**
2. The default login is "**admin**" and no password is set.
3. Press **Connect.**

![](./img/fail-over-ptp-gui-example-01-2e080bb73a28f69ea7a2e3c476b826b.webp)

### Configure bridge

Add new bridge:

1. Open the Bridge sub-menu;
2. Press on "+" to add a new bridge;
3. Apply your changes.

![](./img/fail-over-ptp-gui-example-02-b4a51038c36fea6f7d23eed32558896.webp)

*Later in the instructions it requires assigning bridge members to it. This will allow passing traffic from Ethernet to W60G interface without routing.*

### Set up 60Ghz wireless connection

All previously explained steps are identical to **bridge** and **station** devices. Different modes need to be used when configuring wireless interfaces.

Configure **bridge** device as follows:

1. Open the Interface menu;
2. Double click on the wlan60-1 interface;
3. Click the Wireless sub-menu and set mode to **bridge** (or **ap-bridge** for PtmP);
4. Set the SSID and password and region;
5. Select the previously created bridge under "Put Stations In Bridge";
6. Apply your changes;
7. Press Enable to start transmitting.

![](./img/fail-over-ptp-gui-example-03-b9517329a523436642b3f4b3dad0a98.webp)

Configure **station** device as follows:

1. Open Interface menu;
2. Double click on wlan60-1 interface;
3. Press on Wireless sub-menu and set mode to **station bridge**;
4. Set SSID and password;
5. Apply your changes;
6. Press enable to start transmitting.

![](./img/fail-over-ptp-gui-example-04-bcadd896b5e1c8e858126082c5c8aeb.webp)

### Set up 5Ghz wireless connection

#### Choose Security Profile for your devices

1. Choose the **Wireless** menu;
2. Choose the **Security Profiles** sub-menu;
3. Add a new profile with the "**+**" sign;
4. Choose **a name**, **mode**, **authentication type** and a secure password;
5. **Apply** the configuration.

**![](./img/fail-over-ptp-gui-example-05-eb893c0c5e0056e8185a785f5b0ce5e.webp)**

#### For bridge device

1. Open the **Interfaces** menu;
2. Double click on the **wlan1** interface;
3. Press on the **Wireless** sub-menu and set mode to **bridge** (or **ap-bridge** for PtmP);
4. Set **SSID**, **password** and **country**;
5. Press on the **Advanced Mode**;

![](./img/fail-over-ptp-gui-example-06-3012f0761101eb5d870eb46ad771d5c.webp)

1. Choose your **Security Profile**;
2. **Apply** your changes;
3. Press **enable** to start transmitting.

![](./img/fail-over-ptp-gui-example-07-e9e88bdc0ea9dc2cdacc91423f707f9.webp)

#### For station device

1. Open the **Interfaces** menu;
2. Double click on the **wlan1** interface;
3. Open the **Wireless** sub-menu and set mode to **station-bridge**;
4. Set **SSID**, **password** and **country**;
5. Open the **advanced** mode (similar to the bridge device\*);
6. Choose **Security Profile**;
7. **Apply** your changes;
8. Press **enable** to start transmitting.

![](./img/fail-over-ptp-gui-example-08-69bfb2858a706c1dc085110eeab0242.webp)

*If everything is done correctly - running (R) flags should appear as shown in the screenshot:*  
![](./img/fail-over-ptp-gui-example-09-15335aab2327ef3c815033f5a3b728b.webp)

### Configure bonding

*Configure bonding and assign slave interfaces in this setup it is selected as the built-in wlan1 interface, but it can also be an ether interface in other kinds of setups.*

#### For bridge device

1. Press the **Bonding** sub-menu;
2. Add a new member with "**+**";
3. Add interface members (**wlan1** and **wlan60-station-1**) to the **bonding** interface as **Slaves**;
4. Add interface member **wlan60-station-1** as the **Primary** interface;
5. Choose Mode as **active backup**;
6. **Apply** the configuration.

![](./img/fail-over-ptp-gui-example-10-85e8e7cb74a746b24ec473e691394a0.webp)

#### For station device

1. Press on the **Bonding** sub-menu;
2. Add a new member with "**+**";
3. Add interface members (**wlan1** and **wlan60-1**) to the **bonding** interface as **Slaves**;
4. Add the interface member **wlan60-1** as the **Primary** interface;
5. Choose Mode as **active backup**;
6. **Apply** the configuration.

![](./img/fail-over-ptp-gui-example-11-df3b5827bd3a96e0dc9886f19c38c02.webp)

### Configure bridge

*Configuring bridge settings including the bonding interface is mandatory for the active-backup to work on used devices (In this case bridge and station device settings are the same):*

1. Press on the **Bridge** sub-menu;
2. Add a new member with "**+**";
3. Add the interface member as **ether1** and the Bridge member as **bridge1**;
4. **Apply** the configuration;

*![](./img/fail-over-ptp-gui-example-12-ff0bb4736c97bfe805acdabd974088c.webp)*

1. Press on the **Bridge** sub-menu;
2. Add a new member with "**+**";
3. Add the interface member as **bonding1** and the Bridge member as **bridge1**;
4. **Apply** the configuration.

*![](./img/fail-over-ptp-gui-example-13-1e96c86f63ff55b4a6184e96e5ee537.webp)*

### Additional configuration

Interfaces, when enabled from greyed out, will become active.

Link should be established after all previously explained steps are done. It's recommended to set up an administrator password on both devices.
