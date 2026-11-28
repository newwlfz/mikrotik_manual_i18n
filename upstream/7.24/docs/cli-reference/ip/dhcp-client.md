# dhcp-client

> RouterOS directory reference for /ip/dhcp-client.

-----------

## ip/dhcp-client 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1"></ArgTableRow>
<ArgTableRow arg="add-default-route" typ="enum (no | yes | special-classless)"></ArgTableRow>
<ArgTableRow arg="default-route-distance" typ="num"></ArgTableRow>
<ArgTableRow arg="default-route-tables" typ="object { table: alt { table-distance: composite { table: alt { table-default: enum (default) { default:0xffffffff }
, table: enum
 }
, distance: num [1 .. 255]
 }
, table: alt { table-default: enum (default) { default:0xffffffff }
, table: enum
 }
 }
 }"></ArgTableRow>
<ArgTableRow arg="check-gateway" typ="enum (none | arp | ping | bfd)"></ArgTableRow>
<ArgTableRow arg="use-peer-dns" typ="bool"></ArgTableRow>
<ArgTableRow arg="use-peer-ntp" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow-reconfigure" typ="bool"></ArgTableRow>
<ArgTableRow arg="vlan-priority" typ="num">Priority of outgoing packets; applicable for VLAN interface only</ArgTableRow>
<ArgTableRow arg="dscp" typ="num">DSCP of outgoing packets</ArgTableRow>
<ArgTableRow arg="use-broadcast" typ="enum (always | never | both)">Controls BROADCAST flag of DHCPDISCOVER and DHCPREQUEST (during requesting and rebinding only) messages</ArgTableRow>
<ArgTableRow arg="dhcp-options" typ="multi { array-id, option: enum
 }"></ArgTableRow>
<ArgTableRow arg="script" typ="alt { script: string
 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="custom-source-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="custom-hostname-suffix" typ="string"></ArgTableRow>
<ArgTableRow arg="status" typ="enum (stopped | searching... | requesting... | bound | renewing... | rebinding... | error) { stopped:0, searching...:1, requesting...:2, bound:3, renewing...:4, rebinding...:5, error:6 }"></ArgTableRow>
<ArgTableRow arg="address" typ="composite { address: ipAddr
, netmask: num [ .. 32]
 }"></ArgTableRow>
<ArgTableRow arg="netmask" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="gateway" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="dhcp-server" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="primary-dns" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="secondary-dns" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="primary-ntp" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="secondary-ntp" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="caps-managers" typ="multi { ip: ipAddr
 }"></ArgTableRow>
<ArgTableRow arg="reconfigure-key" typ="string"></ArgTableRow>
<ArgTableRow arg="reconfigure-last-counter" typ="string"></ArgTableRow>
<ArgTableRow arg="expires-after" typ="time"></ArgTableRow>
</ArgTable>
