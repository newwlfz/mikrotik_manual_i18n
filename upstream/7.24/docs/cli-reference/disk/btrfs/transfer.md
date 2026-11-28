# transfer

> RouterOS directory reference for /disk/btrfs/transfer.

-----------

## disk/btrfs/transfer 
**Conditions:** !smips
**Syscap:** storage
**Type:** Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="type" typ="enum (receive | send)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="fs" typ="enum"></ArgTableRow>
<ArgTableRow arg="send-parent" typ="enum"></ArgTableRow>
<ArgTableRow arg="send-subvolumes" typ="multi { array-id, subvolume: enum
 }"></ArgTableRow>
<ArgTableRow arg="file" typ="file"></ArgTableRow>
<ArgTableRow arg="ssh-address" typ="string"></ArgTableRow>
<ArgTableRow arg="ssh-receive-mount" typ="string"></ArgTableRow>
<ArgTableRow arg="ssh-port" typ="num"></ArgTableRow>
<ArgTableRow arg="ssh-user" typ="string"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="status" typ="string"></ArgTableRow>
</ArgTable>
