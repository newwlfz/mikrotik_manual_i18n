---
sidebar_key: "getting-started/configuration-management/list-of-menus-with-sensitive-parameters"
sidebar_position: 6
title: "List of menus with sensitive parameters"
source: https://manual.mikrotik.com/docs/7.24/getting-started/configuration-management/list-of-menus-with-sensitive-parameters
captured_at: '2026-11-04T11:28:31+08:00'
---

Below you can find a list of menus where sensitive (shown only when [show-sensitive parameter](/docs/7.24/getting-started/configuration-management/#configuration-export) is used or alternatively hidden when "Hide password" is enabled in WinBox settings) parameters can be configured. For more detailed information, please refer to the corresponding menu documentation pages.

| Menu | Parameter names | Page link |
| :-- | :-- | :-- |
| `/container` | password | [Container#Containerconfiguration](/docs/7.24/containers/) |
| `/ip/hotspot` | mac-auth-password, password, otp-secret | [HotSpot - Captive portal#HotSpotUsers](/docs/7.24/authentication-authorization-accounting/hotspot-captive-portal/) |
| `/iot` | password, key | password - [MQTT#Brokers](/docs/7.24/internet-of-things/mqtt/)  key - [Lora#Servers](/docs/7.24/internet-of-things/lora/general-properties#servers)|
| `/interface/gre`  `/interface/gre6` | ipsec-secret | [GRE#Properties](/docs/7.24/virtual-private-networks/gre) |
| `/interface/ipip`  `/interface/ipipv6` | ipsec-secret | [IPIP#Properties](/docs/7.24/virtual-private-networks/ipip) |
| `/interface/eoip`  `/interface/eoipv6` | ipsec-secret | [EoIP#PropertyDescription](/docs/7.24/virtual-private-networks/eoip) |
| `/interface/6to4` | ipsec-secret | [6to4#6to4-PropertyDescription](/docs/7.24/virtual-private-networks/6to4) |
| `/interface/ppp-client` | password, pin | Work in Progress [PPP](/docs/7.24/mobile-networking/ppp) |
| `/interface/sstp-client` | password | [SSTP#Properties](/docs/7.24/virtual-private-networks/sstp) |
| `/interface/l2tp-server`  `/interface/l2tp-client`  `/interface/l2tp-ether` | ipsec-secret, password | ipsec-secret, password - [L2TP#L2TPClient](/docs/7.24/virtual-private-networks/l2tp/#l2tp-client)  ipsec-secret - [L2TP#L2TPServer](/docs/7.24/virtual-private-networks/l2tp/#l2tp-server)  ipsec-secret - [L2TP#L2TPEther](/docs/7.24/virtual-private-networks/l2tp/#l2tp-ether)|
| `/interface/ovpn-client` | password | [OpenVPN#OVPNClient](/docs/7.24/virtual-private-networks/openvpn) |
| `/interface/pptp-client` | password | [PPTP#PPTPClient](/docs/7.24/virtual-private-networks/pptp) |
| `/interface/pppoe-client` | password | [PPPoE#PPPoEClient](/docs/7.24/virtual-private-networks/pppoe/) |
| `/ppp/secret` | password | [PPP AAA#UserDatabase](/docs/7.24/authentication-authorization-accounting/ppp-aaa) |
| `/ppp/l2tp-secret` | secret | Work in Progress |
| `/ip/ssh/export-host-key`  `/ip/ssh/import-host-key` | passphrase | [SSH#SSHServer](/docs/7.24/management-tools/ssh) |
| `/ip/ipsec` | auth-key, enc-key, ppk-secret, secret, password, passphrase, key | auth-key, enc-key - [IPsec#InstalledSAs](/docs/7.24/virtual-private-networks/ipsec/#installed-sas)  secret, password - [IPsec#Identities](/docs/7.24/virtual-private-networks/ipsec/#identities)  ppk-secret - Work in Progress [IPsec#Peers](/docs/7.24/virtual-private-networks/ipsec/#peers)  key, passphrase - Work in Progress [IPsec#Keys](/docs/7.24/virtual-private-networks/ipsec/#keys)|
| `/system/ssh-exec` | password | [SSH#SSHexec](/docs/7.24/management-tools/ssh) |
| `/user` | password, passphrase | [User](/docs/7.24/authentication-authorization-accounting/user) |
| `/disk` | nvme-tcp-server-password, nvme-tcp-password, smb-server-password, smb-password, self-encryption-password, encryption-key, sshfs-password | nvme-tcp-server-password, nvme-tcp-password - [NVMe over TCP](/docs/7.24/storage/nvme-over-tcp)  sshfs-password - Work in Progress  smb-server-password, smb-password - [SMB](/docs/7.24/storage/smb)  self-encryption-password, encryption-key - [Self-Encrypting Drives](/docs/7.24/storage/self-encrypting-drives)|
| `/interface/vrrp` | password | [VRRP#Parameters](/docs/7.24/high-availability-solutions/vrrp) |
| `/interface/dot1x` | password | [Dot1X#Client](/docs/7.24/authentication-authorization-accounting/dot1x) |
| `/interface/macsec` | cak | [MACsec#PropertyReference](/docs/7.24/bridging-and-switching/macsec) |
| `/interface/wireguard` | private-key, preshared-key, \**show-client-config* | [WireGuard](/docs/7.24/virtual-private-networks/wireguard) |
| `/interface/lte` | pin, password | [LTE/5G#LTEClient](/docs/7.24/mobile-networking/lte-5g#lte-client) |
| `/socks/users` | password | [SOCKS](/docs/7.24/network-management/socks/) |
| `/ip/cloud` | vpn-private-key, vpn-peer-private-key, private-key | [Back To Home#Propertyreference](/docs/7.24/network-management/cloud/back-to-home) |
| `/ip/smb` | password | [SMB#Usersetup](/docs/7.24/storage/smb) |
| `/password` | old-password, new-password, confirm-new-password | Password change command; no dedicated documentation page available. |
| `/radius` | secret | [RADIUS#RADIUSClient](/docs/7.24/authentication-authorization-accounting/radius) |
| `/routing` | password, tcp-md5-key, auth-key, key | password,key - [/routing/rip](/docs/7.24/cli-reference/routing/rip/instance)  tcp-md5-key - [/routing/bgp/connection](/docs/7.24/cli-reference/routing/bgp/connection)  auth-key - [/routing/ospf](/docs/7.24/cli-reference/routing/ospf/interface-template)|
| `/snmp/community` | authentication-password, encryption-password | [SNMP#CommunityProperties](/docs/7.24/diagnostics-monitoring-and-troubleshooting/snmp) |
| `/system/backup` | password | [Backup](/docs/7.24/getting-started/configuration-management/backup) |
| `/system/ntp/key` | key-val | Work in Progress [NTP](/docs/7.24/system-information-and-utilities/ntp) |
| `/system/swos/password` | new-password, confirm-new-password | SwOS password change command; no dedicated documentation page available. |
| `/system/package/local-update` | password | [Packages#LocalUpdate](/docs/7.24/getting-started/installation-and-upgrade/packages) |
| `/system/license` | password | [RouterOS license keys#CHRLicenseLevels](/docs/7.24/getting-started/routeros-licensing/chr/chr-licensing#chr-license-levels) |
| `/tool/romon` | secrets | [RoMON#Configuration](/docs/7.24/management-tools/romon) |
| `/tool/sms` | sim-pin, secret | [SMS#Receiving](/docs/7.24/mobile-networking/sms) |
| `/tool/email` | password | [E-mail](/docs/7.24/system-information-and-utilities/e-mail) |
| `/tr069-client` | connection-request-password, password | [TR-069#ConfigurationSettings](/docs/7.24/management-tools/tr-069) |
| `/user-manager` | web-private-password, paypal-password, shared-secret, password, otp-secret | shared-secret - [User Manager#Routers](/docs/7.24/authentication-authorization-accounting/user-manager#routers)  paypal-password, web-private-password - [User Manager#Advanced](/docs/7.24/authentication-authorization-accounting/user-manager#advanced)  password, otp-secret - [User Manager#Users](/docs/7.24/authentication-authorization-accounting/user-manager#users)|
| `/interface/wifi` | passphrase, eap-password | [WiFi#SecurityProperties](/docs/7.24/wireless/wifi/) |
| `/caps-man` | private-passphrase, passphrase | private-passphrase - [CAPsMAN#CAPsMANAccess-list](/docs/7.24/wireless/abgn/capsman/#capsman-access-list)  passphrase - [CAPsMAN#CAPsMANconfiguration](/docs/7.24/wireless/abgn/capsman/#capsman-configuration)|
| `/interface/wireless` | static-key-0, static-key-1, static-key-2, static-key-3, static-sta-private-key, management-protection-key, nv2-preshared-key, private-key, private-pre-shared-key, wpa-pre-shared-key, wpa2-pre-shared-key, mschapv2-password | static-key-0, static-key-1, static-key-2, static-key-3, static-sta-private-key - [Wireless Interface#WEPproperties](/docs/7.24/wireless/)  management-protection-key, private-key, private-pre-shared-key - [Wireless Interface#Properties](/docs/7.24/wireless/)  wpa-pre-shared-key, wpa2-pre-shared-key - [Wireless Interface#WPAproperties](/docs/7.24/wireless/)  mschapv2-password - [Wireless Interface#WPAEAPproperties](/docs/7.24/wireless/)  nv2-preshared-key - [Wireless Interface#Generalinterfaceproperties](/docs/7.24/wireless/) |
| `/interface/w60g` | password | [W60G#Generalinterfaceproperties](/docs/7.24/wireless/w60g/) |
| `/zerotier` | identity | [ZeroTier#Parameters](/docs/7.24/virtual-private-networks/zerotier) |
| `/certificate` | export-passphrase, passphrase, challenge-password, pin, key-passphrase, challenge-passphrase | pin - used for card-reinstall and card-verify commands, no dedicated documentation page available.  export-passphrase - [Certificates#ExportCertificate](/docs/7.24/authentication-authorization-accounting/certificates#export-certificate)  passphrase - [Certificates#ImportCertificate](/docs/7.24/authentication-authorization-accounting/certificates#import-certificate)  challenge-password, key-passphrase, challenge-passphrase - Work in progress |
