---
sidebar_key: "cli-reference/disk/index"
sidebar_position: 7
title: "disk"
sidebar_label: 'disk'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/disk
captured_at: '2026-11-01T21:26:42+08:00'
---

-----------

## disk 
**Conditions:** !smips
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled">disabled</ArgTableRow>
<ArgTableRow arg="A" typ="acquired">acquired</ArgTableRow>
<ArgTableRow arg="E" typ="empty">empty</ArgTableRow>
<ArgTableRow arg="B" typ="block-device">block-device</ArgTableRow>
<ArgTableRow arg="M" typ="mounted">mounted</ArgTableRow>
<ArgTableRow arg="F" typ="formatting">formatting</ArgTableRow>
<ArgTableRow arg="S" typ="swap-enabled">swap-enabled</ArgTableRow>
<ArgTableRow arg="f" typ="raid-member-failed">raid-member-failed</ArgTableRow>
<ArgTableRow arg="r" typ="raid-member">raid-member</ArgTableRow>
<ArgTableRow arg="c" typ="encrypted">encrypted</ArgTableRow>
<ArgTableRow arg="g" typ="guid-partition-table">guid-partition-table</ArgTableRow>
<ArgTableRow arg="p" typ="partition">partition</ArgTableRow>
<ArgTableRow arg="t" typ="nvme-tcp-export">nvme-tcp-export</ArgTableRow>
<ArgTableRow arg="i" typ="iscsi-export">iscsi-export</ArgTableRow>
<ArgTableRow arg="s" typ="smb-sharing">smb-sharing</ArgTableRow>
<ArgTableRow arg="n" typ="nfs-sharing">nfs-sharing</ArgTableRow>
<ArgTableRow arg="m" typ="media-sharing">media-sharing</ArgTableRow>
<ArgTableRow arg="L" typ="self-encrypted-and-locked">self-encrypted-and-locked</ArgTableRow>
<ArgTableRow arg="O" typ="self-encryption-enabled">self-encryption-enabled</ArgTableRow>
<ArgTableRow arg="o" typ="self-encryption-supported">self-encryption-supported</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="type" typ="enum (raid | nvme-tcp | iscsi | nfs | smb | partition | tmpfs | ramdisk | crypted | sshfs | file | hardware)" mandatory="1"></ArgTableRow>
<ArgTableRow arg="slot" typ="string"></ArgTableRow>
<ArgTableRow arg="parent" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="mount-point-template" typ="string"></ArgTableRow>
<ArgTableRow arg="mount-filesystem" typ="bool"></ArgTableRow>
<ArgTableRow arg="mount-read-only" typ="bool"></ArgTableRow>
<ArgTableRow arg="compress" typ="bool"></ArgTableRow>
<ArgTableRow arg="partition-number" typ="num"></ArgTableRow>
<ArgTableRow arg="partition-offset" typ="num"></ArgTableRow>
<ArgTableRow arg="partition-size" typ="num"></ArgTableRow>
<ArgTableRow arg="raid-type" typ="enum (0 | 1 | 4 | 5 | 6 | linear) { 0:0, 1:1, 4:4, 5:5, 6:6 }" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-device-count" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-max-component-size" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-chunk-size" typ="enum (64K | 128K | 256K | 512K | 1M | 2M | 4M) { 64K:64, 128K:128, 256K:256, 512K:512, 1M:1024, 2M:2048, 4M:4096 }" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-master" typ="enum (none)" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-role" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="raid-member-failed" typ="bool" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-export" typ="bool" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-server-port" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-server-nqn" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-server-allow-host-name" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-server-password" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-address" typ="ipAddr" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-nqn" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-host-name" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-password" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-port" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-export" typ="bool" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-server-port" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-server-iqn" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-port" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-address" typ="ipAddr" syscap="storage"></ArgTableRow>
<ArgTableRow arg="iscsi-iqn" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nfs-sharing" typ="bool" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nfs-address" typ="ipAddr" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nfs-share" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="smb-sharing" typ="bool"></ArgTableRow>
<ArgTableRow arg="smb-server-user" typ="enum ()"></ArgTableRow>
<ArgTableRow arg="smb-server-password" typ="string"></ArgTableRow>
<ArgTableRow arg="smb-server-encryption" typ="bool"></ArgTableRow>
<ArgTableRow arg="smb-address" typ="ipAddr"></ArgTableRow>
<ArgTableRow arg="smb-share" typ="string"></ArgTableRow>
<ArgTableRow arg="smb-user" typ="string"></ArgTableRow>
<ArgTableRow arg="smb-password" typ="string"></ArgTableRow>
<ArgTableRow arg="smb-encryption" typ="bool"></ArgTableRow>
<ArgTableRow arg="media-sharing" typ="bool"></ArgTableRow>
<ArgTableRow arg="media-interface" typ="iface_enum { none }"></ArgTableRow>
<ArgTableRow arg="tmpfs-max-size" typ="num"></ArgTableRow>
<ArgTableRow arg="ramdisk-size" typ="num" syscap="storage"></ArgTableRow>
<ArgTableRow arg="crypted-backend" typ="enum (none)" syscap="storage"></ArgTableRow>
<ArgTableRow arg="encryption-key" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="self-encryption-password" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="sshfs-address" typ="string"></ArgTableRow>
<ArgTableRow arg="sshfs-port" typ="num"></ArgTableRow>
<ArgTableRow arg="sshfs-user" typ="string"></ArgTableRow>
<ArgTableRow arg="sshfs-password" typ="string"></ArgTableRow>
<ArgTableRow arg="sshfs-path" typ="string"></ArgTableRow>
<ArgTableRow arg="swap" typ="bool"></ArgTableRow>
<ArgTableRow arg="file-path" typ="file"></ArgTableRow>
<ArgTableRow arg="file-size" typ="num"></ArgTableRow>
<ArgTableRow arg="file-offset" typ="num"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="slot-default" typ="string"></ArgTableRow>
<ArgTableRow arg="fs-label" typ="string"></ArgTableRow>
<ArgTableRow arg="fs-uuid" typ="string"></ArgTableRow>
<ArgTableRow arg="fs" typ="enum (fat32 | ext4 | btrfs | xfs | nfs | smb | wipe | wipe-quick | tmpfs | exfat | ntfs | sshfs | squashfs | iso | discard | discard-secure | -)"></ArgTableRow>
<ArgTableRow arg="model" typ="string"></ArgTableRow>
<ArgTableRow arg="serial" typ="string"></ArgTableRow>
<ArgTableRow arg="fw-version" typ="string"></ArgTableRow>
<ArgTableRow arg="size" typ="num"></ArgTableRow>
<ArgTableRow arg="free" typ="num"></ArgTableRow>
<ArgTableRow arg="total-inodes" typ="num"></ArgTableRow>
<ArgTableRow arg="free-inodes" typ="num"></ArgTableRow>
<ArgTableRow arg="use" typ="num"></ArgTableRow>
<ArgTableRow arg="mount-point" typ="string"></ArgTableRow>
<ArgTableRow arg="sector-size" typ="num"></ArgTableRow>
<ArgTableRow arg="interface" typ="string"></ArgTableRow>
<ArgTableRow arg="interface-speed" typ="num"></ArgTableRow>
<ArgTableRow arg="raid-member-state" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="state" typ="string"></ArgTableRow>
<ArgTableRow arg="last-seen" typ="string"></ArgTableRow>
<ArgTableRow arg="raid-uuid" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-server-secret" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="nvme-tcp-secret" typ="string" syscap="storage"></ArgTableRow>
<ArgTableRow arg="sshfs-local-user" typ="string"></ArgTableRow>
<ArgTableRow arg="io-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="io-errors" typ="num"></ArgTableRow>
<ArgTableRow arg="read-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="read-ops-per-second" typ="num"></ArgTableRow>
<ArgTableRow arg="read-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="read-rate" typ="num"></ArgTableRow>
<ArgTableRow arg="read-merges" typ="num"></ArgTableRow>
<ArgTableRow arg="read-time" typ="time"></ArgTableRow>
<ArgTableRow arg="write-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="write-ops-per-second" typ="num"></ArgTableRow>
<ArgTableRow arg="write-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="write-rate" typ="num"></ArgTableRow>
<ArgTableRow arg="write-merges" typ="num"></ArgTableRow>
<ArgTableRow arg="write-time" typ="time"></ArgTableRow>
<ArgTableRow arg="in-flight-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="active-time" typ="time"></ArgTableRow>
<ArgTableRow arg="wait-time" typ="time"></ArgTableRow>
<ArgTableRow arg="discard-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="discard-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="discard-merges" typ="num"></ArgTableRow>
<ArgTableRow arg="discard-time" typ="time"></ArgTableRow>
<ArgTableRow arg="flush-ops" typ="num"></ArgTableRow>
<ArgTableRow arg="flush-time" typ="time"></ArgTableRow>
<ArgTableRow arg="temperature" typ="num"></ArgTableRow>
<ArgTableRow arg="temperatures" typ="multi { array-id, slot: num
 }"></ArgTableRow>
<ArgTableRow arg="critical-warning" typ="ubit (spare-space, temperature, reliability-degraded, read-only, volatile-backup-failed)"></ArgTableRow>
<ArgTableRow arg="available-spare" typ="num"></ArgTableRow>
<ArgTableRow arg="available-spare-threshold" typ="num"></ArgTableRow>
<ArgTableRow arg="percentage-used" typ="num"></ArgTableRow>
<ArgTableRow arg="host-read-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="host-write-bytes" typ="num"></ArgTableRow>
<ArgTableRow arg="host-read-cmds" typ="num"></ArgTableRow>
<ArgTableRow arg="host-write-cmds" typ="num"></ArgTableRow>
<ArgTableRow arg="controller-busy-time" typ="time"></ArgTableRow>
<ArgTableRow arg="power-cycles" typ="num"></ArgTableRow>
<ArgTableRow arg="power-on-time" typ="time"></ArgTableRow>
<ArgTableRow arg="unsafe-shutdowns" typ="num"></ArgTableRow>
<ArgTableRow arg="unrecovered-integrity-errors" typ="num"></ArgTableRow>
<ArgTableRow arg="warning-temperature" typ="num"></ArgTableRow>
<ArgTableRow arg="warning-temperature-time" typ="time"></ArgTableRow>
<ArgTableRow arg="critical-temperature" typ="num"></ArgTableRow>
<ArgTableRow arg="critical-temperature-time" typ="time"></ArgTableRow>
</ArgTable>
