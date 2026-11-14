---
sidebar_key: "cli-reference/openflow/port"
sidebar_position: 4
title: "port"
sidebar_label: 'port'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/openflow/port
captured_at: '2026-11-01T21:24:54+08:00'
---

-----------

## openflow/port 
**Package:** openflow
**Type:** Directory

This menu lists the ports controlled by OpenFlow.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="X" typ="disabled"></ArgTableRow>
<ArgTableRow arg="I" typ="inactive"></ArgTableRow>
<ArgTableRow arg="D" typ="dynamic"></ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="interface" typ="enum ()" mandatory="1">Name of the interface to be controlled by OpenFlow.</ArgTableRow>
<ArgTableRow arg="switch" typ="enum" mandatory="1">Name of the switch able to control the port.</ArgTableRow>
<ArgTableRow arg="port-id" typ="num">Port ID used to identify the interface in flow rules.</ArgTableRow>
</ArgTable>

<ArgTable c1="Read-only Argument" c2="Type" c3="Description">
<ArgTableRow arg="tx-bytes" typ="num">Number of bytes transmitted on the interface.</ArgTableRow>
<ArgTableRow arg="tx-packets" typ="num">Number of packets transmitted on the interface.</ArgTableRow>
<ArgTableRow arg="rx-bytes" typ="num">Number of bytes received on the interface.</ArgTableRow>
<ArgTableRow arg="rx-packets" typ="num">Number of packets received on the interface.</ArgTableRow>
</ArgTable>
