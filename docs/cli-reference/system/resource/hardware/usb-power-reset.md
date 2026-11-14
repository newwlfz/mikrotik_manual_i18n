---
sidebar_key: "cli-reference/system/resource/hardware/usb-power-reset"
sidebar_position: 5
title: "usb-power-reset"
sidebar_label: 'usb-power-reset'
source: https://manual.mikrotik.com/docs/cli-reference/system/resource/hardware/usb-power-reset
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## system/resource/hardware/usb-power-reset 
**Conditions:** !powerpc, !smips, i386
**Type:** Command
Power-cycle a USB port: power off for `duration` and back on (resets misbehaving modems and drives without rebooting the router).

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="duration" typ="time">Power-off duration before re-enabling USB</ArgTableRow>
<ArgTableRow arg="bus" typ="num">USB bus number (as shown by `/system/resource/hardware`)</ArgTableRow>
<ArgTableRow arg="slot" typ="num">USB slot number on the bus</ArgTableRow>
</ArgTable>
