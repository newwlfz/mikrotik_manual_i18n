---
sidebar_key: "cli-reference/cmr/device/reboot"
sidebar_position: 4
title: "reboot"
sidebar_label: 'reboot'
source: https://manual.mikrotik.com/docs/cli-reference/cmr/device/reboot
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## cmr/device/reboot 
**Package:** cmr
**Type:** Command

Reboots the selected devices. The command returns right away. When a device has restarted, the `rebooted` example alert rule logs `<device> rebooted`, where `<device>` is `identity@address`.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="labels" typ="object" unset="1">Select the devices to reboot using labels. Supports + and - signs as AND and AND NOT operators, respectively; if no sign is provided, the OR operator is used.</ArgTableRow>
</ArgTable>
