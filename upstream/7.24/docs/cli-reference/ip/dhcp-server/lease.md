# lease

> RouterOS directory reference for /ip/dhcp-server/lease.

-----------

## ip/dhcp-server/lease 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="R" typ="radius">radius</ArgTableRow>
<ArgTableRow arg="D" typ="dynamic">dynamic</ArgTableRow>
<ArgTableRow arg="B" typ="blocked">blocked</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="alt { ip-address: ipAddr
, pool: enum
 }"></ArgTableRow>
<ArgTableRow arg="mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="use-src-mac" typ="bool"></ArgTableRow>
<ArgTableRow arg="client-id" typ="string"></ArgTableRow>
<ArgTableRow arg="rate-limit" typ="string"></ArgTableRow>
<ArgTableRow arg="routes" typ="object { route: composite { dst-address: address (flags=4/)
, gateway: [ composite { gateway: address (flags=46ivL)
, distance: [ num [1 .. 255]]
 }]
 }
 }">Routes that appear on the server when the client is connected</ArgTableRow>
<ArgTableRow arg="insert-queue-before" typ="enum (bottom | first) { bottom:0xffffffff, first:0 }"></ArgTableRow>
<ArgTableRow arg="parent-queue" typ="enum (none) { none:0 }"></ArgTableRow>
<ArgTableRow arg="queue-type" typ="enum"></ArgTableRow>
<ArgTableRow arg="address-lists" typ="multi { array-id, address-list: string
 }"></ArgTableRow>
<ArgTableRow arg="server" typ="enum (all) { all:0 }"></ArgTableRow>
<ArgTableRow arg="block-access" typ="bool"></ArgTableRow>
<ArgTableRow arg="allow-dual-stack-queue" typ="bool"></ArgTableRow>
<ArgTableRow arg="lease-time" typ="time"></ArgTableRow>
<ArgTableRow arg="always-broadcast" typ="bool"></ArgTableRow>
<ArgTableRow arg="dhcp-option" typ="multi { array-id, option: enum
 }"></ArgTableRow>
<ArgTableRow arg="dhcp-option-set" typ="enum (none)"></ArgTableRow>
<ArgTableRow arg="agent-circuit-id" typ="string">If non-empty, use it to match lease by Option 82 even if MAC or client-id differ</ArgTableRow>
<ArgTableRow arg="agent-remote-id" typ="string">If non-empty, use it to match lease by Option 82 even if MAC or client-id differ</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="status" typ="enum (waiting | testing | declined | offered | bound | authorizing | conflict) { waiting:0, testing:1, declined:2, offered:3, bound:4, authorizing:5 }"></ArgTableRow>
<ArgTableRow arg="expires-after" typ="time"></ArgTableRow>
<ArgTableRow arg="last-seen" typ="alt { symbolic-names: enum (never | sometime) { never:0xffffffff, sometime:0xfffffffe }
, time: time
 }"></ArgTableRow>
<ArgTableRow arg="age" typ="time"></ArgTableRow>
<ArgTableRow arg="active-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="active-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="active-client-id" typ="string"></ArgTableRow>
<ArgTableRow arg="active-server" typ="enum"></ArgTableRow>
<ArgTableRow arg="active-agent-circuit-id" typ="string"></ArgTableRow>
<ArgTableRow arg="active-agent-remote-id" typ="string"></ArgTableRow>
<ArgTableRow arg="host-name" typ="string"></ArgTableRow>
<ArgTableRow arg="class-id" typ="string">DHCP option 60 from last received DHCP request</ArgTableRow>
<ArgTableRow arg="src-mac-address" typ="macAddr"></ArgTableRow>
<ArgTableRow arg="reconfigure-key" typ="string"></ArgTableRow>
<ArgTableRow arg="reconfigure-last-sent" typ="string"></ArgTableRow>
<ArgTableRow arg="reconfigure-status" typ="string"></ArgTableRow>
</ArgTable>
