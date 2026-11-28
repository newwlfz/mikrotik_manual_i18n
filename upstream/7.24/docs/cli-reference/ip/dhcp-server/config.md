# config

> RouterOS settings reference for /ip/dhcp-server/config.

-----------

## ip/dhcp-server/config 
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="store-leases-disk" typ="alt { symbolic-names: enum (immediately | never) { immediately:0, never:0xffffffff }
, time-interval: time
 }"></ArgTableRow>
<ArgTableRow arg="accounting" typ="bool"></ArgTableRow>
<ArgTableRow arg="interim-update" typ="time"></ArgTableRow>
<ArgTableRow arg="radius-password" typ="alt { user: enum (empty | same-as-user)
, password: string
 }"></ArgTableRow>
</ArgTable>
