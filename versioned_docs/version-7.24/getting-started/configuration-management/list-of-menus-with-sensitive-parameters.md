---
sidebar_key: "getting-started/configuration-management/list-of-menus-with-sensitive-parameters"
sidebar_position: 4
title: "List of menus with sensitive parameters"
sidebar_label: 'List of menus with sensitive parameters'
description: 'This page lists MikroTik RouterOS menus where sensitive parameters such as passwords, keys, and secrets are configured, with links to detailed documentation for each.'
tags:
  - 'ipsec'
  - 'radius'
source: https://manual.mikrotik.com/docs/7.24/getting-started/configuration-management/list-of-menus-with-sensitive-parameters
captured_at: '2026-11-04T11:28:31+08:00'
---

Below you can find a list of menus where sensitive (shown only when [show-sensitive parameter](/docs/7.24/getting-started/configuration-management/#configuration-export) is used or alternatively hidden when "Hide password" is enabled in WinBox settings) parameters can be configured. For more detailed information, please refer to the corresponding menu documentation pages.

| Menu | Parameter names | Page link |
| :-- | :-- | :-- |
| `/container` | password | [Container#Containerconfiguration](/docs/7.24/containers/) |
| `/ip/hotspot` | mac-auth-password, password, otp-secret | [HotSpot - Captive portal#HotSpotUsers](/docs/7.24/authentication-authorization-accounting/hotspot-captive-portal/) |
| `/iot` | password, key | password - <a href="/docs/7.24/internet-of-things/mqtt/">MQTT#Brokers</a><br/> key - <a href="/docs/7.24/internet-of-things/lora/general-properties#servers">Lora#Servers</a> |
| <code>/interface/gre</code><br/><code>/interface/gre6</code> | ipsec-secret | [GRE#Properties](/docs/7.24/virtual-private-networks/gre) |
| <code>/interface/ipip</code><br/><code>/interface/ipipv6</code> | ipsec-secret | [IPIP#Properties](/docs/7.24/virtual-private-networks/ipip) |
| <code>/interface/eoip</code><br/><code>/interface/eoipv6</code> | ipsec-secret | [EoIP#PropertyDescription](/docs/7.24/virtual-private-networks/eoip) |
| `/interface/6to4` | ipsec-secret | [6to4#6to4-PropertyDescription](/docs/7.24/virtual-private-networks/6to4) |
| `/interface/ppp-client` | password, pin | Work in Progress [PPP](/docs/7.24/mobile-networking/ppp) |
| `/interface/sstp-client` | password | [SSTP#Properties](/docs/7.24/virtual-private-networks/sstp) |
| <code>/interface/l2tp-server</code><br/><code>/interface/l2tp-client</code><br/><code>/interface/l2tp-ether</code> | ipsec-secret, password | ipsec-secret, password - <a href="/docs/7.24/virtual-private-networks/l2tp/#l2tp-client">L2TP#L2TPClient</a><br/> ipsec-secret - <a href="/docs/7.24/virtual-private-networks/l2tp/#l2tp-server">L2TP#L2TPServer</a><br/> ipsec-secret - <a href="/docs/7.24/virtual-private-networks/l2tp/#l2tp-ether">L2TP#L2TPEther</a> |
| `/interface/ovpn-client` | password | [OpenVPN#OVPNClient](/docs/7.24/virtual-private-networks/openvpn) |
| `/interface/pptp-client` | password | [PPTP#PPTPClient](/docs/7.24/virtual-private-networks/pptp) |
| `/interface/pppoe-client` | password | [PPPoE#PPPoEClient](/docs/7.24/virtual-private-networks/pppoe/) |
| `/ppp/secret` | password | [PPP AAA#UserDatabase](/docs/7.24/authentication-authorization-accounting/ppp-aaa) |
| `/ppp/l2tp-secret` | secret | Work in Progress |
| <code>/ip/ssh/export-host-key</code><br/><code>/ip/ssh/import-host-key</code> | passphrase | [SSH#SSHServer](/docs/7.24/management-tools/ssh) |
| `/ip/ipsec` | auth-key, enc-key, ppk-secret, secret, password, passphrase, key | auth-key, enc-key - <a href="/docs/7.24/virtual-private-networks/ipsec/#installed-sas">IPsec#InstalledSAs</a><br/> secret, password - <a href="/docs/7.24/virtual-private-networks/ipsec/#identities">IPsec#Identities</a><br/> ppk-secret - Work in Progress <a href="/docs/7.24/virtual-private-networks/ipsec/#peers">IPsec#Peers</a><br/> key, passphrase - Work in Progress <a href="/docs/7.24/virtual-private-networks/ipsec/#keys">IPsec#Keys</a> |
| `/system/ssh-exec` | password | [SSH#SSHexec](/docs/7.24/management-tools/ssh) |
| `/user` | password, passphrase | [User](/docs/7.24/authentication-authorization-accounting/user) |
| `/disk` | nvme-tcp-server-password, nvme-tcp-password, smb-server-password, smb-password, self-encryption-password, encryption-key, sshfs-password | nvme-tcp-server-password, nvme-tcp-password - <a href="/docs/7.24/storage/nvme-over-tcp">NVMe over TCP</a><br/> sshfs-password - Work in Progress <br/> smb-server-password, smb-password - <a href="/docs/7.24/storage/smb">SMB</a><br/> self-encryption-password, encryption-key - <a href="/docs/7.24/storage/self-encrypting-drives">Self-Encrypting Drives</a> |
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
| `/routing` | password, tcp-md5-key, auth-key, key | password,key - <a href="/docs/7.24/cli-reference/routing/rip/instance">/routing/rip</a><br/> tcp-md5-key - <a href="/docs/7.24/cli-reference/routing/bgp/connection">/routing/bgp/connection</a><br/> auth-key - <a href="/docs/7.24/cli-reference/routing/ospf/interface-template">/routing/ospf</a> |
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
| `/user-manager` | web-private-password, paypal-password, shared-secret, password, otp-secret | shared-secret - <a href="/docs/7.24/authentication-authorization-accounting/user-manager#routers">User Manager#Routers</a><br/> paypal-password, web-private-password - <a href="/docs/7.24/authentication-authorization-accounting/user-manager#advanced">User Manager#Advanced</a><br/> password, otp-secret - <a href="/docs/7.24/authentication-authorization-accounting/user-manager#users">User Manager#Users</a> |
| `/interface/wifi` | passphrase, eap-password | [WiFi#SecurityProperties](/docs/7.24/wireless/wifi/) |
| `/caps-man` | private-passphrase, passphrase | private-passphrase - <a href="/docs/7.24/wireless/abgn/capsman/#capsman-access-list">CAPsMAN#CAPsMANAccess-list</a><br/> passphrase - <a href="/docs/7.24/wireless/abgn/capsman/#capsman-configuration">CAPsMAN#CAPsMANconfiguration</a> |
| `/interface/wireless` | static-key-0, static-key-1, static-key-2, static-key-3, static-sta-private-key, management-protection-key, nv2-preshared-key, private-key, private-pre-shared-key, wpa-pre-shared-key, wpa2-pre-shared-key, mschapv2-password | static-key-0, static-key-1, static-key-2, static-key-3, static-sta-private-key - <a href="/docs/7.24/wireless/">Wireless Interface#WEPproperties</a><br/> management-protection-key, private-key, private-pre-shared-key - <a href="/docs/7.24/wireless/">Wireless Interface#Properties</a><br/> wpa-pre-shared-key, wpa2-pre-shared-key - <a href="/docs/7.24/wireless/">Wireless Interface#WPAproperties</a><br/> mschapv2-password - <a href="/docs/7.24/wireless/">Wireless Interface#WPAEAPproperties</a><br/> nv2-preshared-key - <a href="/docs/7.24/wireless/">Wireless Interface#Generalinterfaceproperties</a> |
| `/interface/w60g` | password | [W60G#Generalinterfaceproperties](/docs/7.24/wireless/w60g/) |
| `/zerotier` | identity | [ZeroTier#Parameters](/docs/7.24/virtual-private-networks/zerotier) |
| `/certificate` | export-passphrase, passphrase, challenge-password, pin, key-passphrase, challenge-passphrase | pin - used for card-reinstall and card-verify commands, no dedicated documentation page available. <br/> export-passphrase - <a href="/docs/7.24/authentication-authorization-accounting/certificates#export-certificate">Certificates#ExportCertificate</a><br/> passphrase - <a href="/docs/7.24/authentication-authorization-accounting/certificates#import-certificate">Certificates#ImportCertificate</a><br/> challenge-password, key-passphrase, challenge-passphrase - Work in progress |
