---
sidebar_key: "cli-reference/system/routerboard/usb/index"
sidebar_position: 1
title: "usb"
source: https://manual.mikrotik.com/docs/cli-reference/system/routerboard/usb
captured_at: '2026-11-01T21:30:05+08:00'
---

-----------

## system/routerboard/usb 
**Conditions:** !i386, !i386, !powerpc
**Type:** Settings Directory

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="type" typ="enum (USB-type-A | mini-PCIe | auto)"></ArgTableRow>
<ArgTableRow arg="usb-mode" typ="enum (automatic | force-host) { automatic:0, force-host:1 }"></ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="auto-type" typ="enum (USB-type-A | mini-PCIe)"></ArgTableRow>
<ArgTableRow arg="bootstrap" typ="enum (host-mode | device-mode) { host-mode:0, device-mode:1 }"></ArgTableRow>
</ArgTable>
