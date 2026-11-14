---
sidebar_key: "cli-reference/ip/upnp/index"
sidebar_position: 1
title: "upnp"
sidebar_label: 'upnp'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/ip/upnp
captured_at: '2026-11-01T21:24:30+08:00'
---

-----------

## ip/upnp 
**Type:** Settings Directory

Universal Plug and Play (UPnP) service settings. The service answers SSDP discovery on UDP port 1900 and control connections on TCP port 2828 of each [internal interface](/docs/7.25/cli-reference/ip/upnp/interfaces). Any change in this menu restarts the service: all dynamic port mappings are removed and clients have to request them again. Configuration examples are on the [UPnP guide page](/docs/7.25/firewall-and-quality-of-service/upnp).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="enabled" typ="bool">Enable the UPnP service. Default: no.</ArgTableRow>
<ArgTableRow arg="allow-disable-external-interface" typ="bool">Allow UPnP clients on the internal interfaces to disable the router's external interface with the `ForceTermination` action, without any authentication. The UPnP standard requires this action to work; set to `no` so local clients cannot take the Internet connection down. Disabling the external interface this way also removes its dynamic port mappings. Default: no.</ArgTableRow>
<ArgTableRow arg="show-dummy-rule" typ="bool">Report an inactive placeholder port mapping (port 0, client 0.0.0.0, description "Dummy inactive rule for windows to work") as the first entry when a client enumerates port mappings. A workaround for client applications that misbehave when no port mappings exist. The dummy entry never appears in `/ip/firewall/nat`. Default: yes.</ArgTableRow>
</ArgTable>
