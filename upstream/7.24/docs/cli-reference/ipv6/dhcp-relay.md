# dhcp-relay

> RouterOS directory reference for /ipv6/dhcp-relay.

-----------

## ipv6/dhcp-relay 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="I" typ="invalid">invalid</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1"></ArgTableRow>
<ArgTableRow arg="interface" typ="iface_enum" mandatory="1">Relay will listen to messages originating from clients on this interface</ArgTableRow>
<ArgTableRow arg="dhcp-server" typ="object { server: alt { interface-address: composite { address6: ip6Addr
, interface: iface_enum
 }
, address6: ip6Addr
 }
 }" mandatory="1">Servers to which the relay message will be forwarded</ArgTableRow>
<ArgTableRow arg="dhcp-options" typ="multi { array-id, option: enum
 }">Options that are added to Relay-Forward messages. Note that option 18 (interface-id) is added automatically so that relay can relay the reply message correctly.</ArgTableRow>
<ArgTableRow arg="link-address" typ="ip6Addr"></ArgTableRow>
<ArgTableRow arg="delay-threshold" typ="alt { const: enum (none) { none:0 }
, time: time
 }">If secs field in DHCP packet is smaller than delay-threshold, then this packet is ignored</ArgTableRow>
<ArgTableRow arg="store-relayed-bindings" typ="bool">Add routes to valid bindings found in reply messages</ArgTableRow>
</ArgTable>
