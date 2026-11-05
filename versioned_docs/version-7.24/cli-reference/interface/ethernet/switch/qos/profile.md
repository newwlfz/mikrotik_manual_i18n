---
sidebar_key: "cli-reference/interface/ethernet/switch/qos/profile"
sidebar_position: 6
title: "profile"
sidebar_label: 'profile'
source: https://manual.mikrotik.com/docs/7.24/cli-reference/interface/ethernet/switch/qos/profile
captured_at: '2026-11-01T21:27:16+08:00'
---

-----------

## interface/ethernet/switch/qos/profile 
**Syscap:** rbswitch and crs_prestera
**Type:** Directory

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="*" typ="default"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="H" typ="hw-offloaded"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="name" typ="string" mandatory="1">QoS Profile name</ArgTableRow>
<ArgTableRow arg="pcp" typ="num"></ArgTableRow>
<ArgTableRow arg="dscp" typ="num"></ArgTableRow>
<ArgTableRow arg="traffic-class" typ="num"></ArgTableRow>
<ArgTableRow arg="automap" typ="bool">Should DSCP and PCP values be automatically mapped to the profile?</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="hw-id" typ="num"></ArgTableRow>
</ArgTable>
