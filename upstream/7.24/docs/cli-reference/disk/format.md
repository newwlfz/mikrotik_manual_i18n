# format

> RouterOS command reference for /disk/format.

-----------

## disk/format 
**Conditions:** !smips
**Type:** Command

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="file-system" typ="enum (fat32 | ext4 | btrfs | xfs | wipe | wipe-quick | exfat | discard | discard-secure)"></ArgTableRow>
<ArgTableRow arg="label" typ="string"></ArgTableRow>
<ArgTableRow arg="mbr-partition-table" typ="bool"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="output" typ="string"></ArgTableRow>
</ArgTable>
