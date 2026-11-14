---
sidebar_key: "cli-reference/tool/traffic-generator/inject"
sidebar_position: 2
title: "inject"
sidebar_label: 'inject'
source: https://manual.mikrotik.com/docs/cli-reference/tool/traffic-generator/inject
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## tool/traffic-generator/inject 
**Type:** Command
Injects raw data into an interface.

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="iface_enum">Interface the raw data is injected to.</ArgTableRow>
<ArgTableRow arg="data" typ="string">Raw data to inject, as a hexadecimal string.</ArgTableRow>
<ArgTableRow arg="priority" typ="num" unset="1">Priority of the injected packet.</ArgTableRow>
</ArgTable>
