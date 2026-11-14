# servers

> RouterOS directory reference for /system/ntp/client/servers.

-----------

## system/ntp/client/servers 
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="address" typ="address (flags=46D)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="min-poll" typ="num"></ArgTableRow>
<ArgTableRow arg="max-poll" typ="num"></ArgTableRow>
<ArgTableRow arg="iburst" typ="bool"></ArgTableRow>
<ArgTableRow arg="auth-key" typ="enum (none) { none:0 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="resolved-address" typ="address (flags=46)"></ArgTableRow>
</ArgTable>
