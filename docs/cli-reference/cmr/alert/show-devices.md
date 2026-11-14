---
sidebar_key: "cli-reference/cmr/alert/show-devices"
sidebar_position: 1
title: "show-devices"
sidebar_label: 'show-devices'
source: https://manual.mikrotik.com/docs/cli-reference/cmr/alert/show-devices
captured_at: '2026-11-09T11:35:47.715Z'
pagination_prev: "cli-reference/cmr/alert"
---

-----------

## cmr/alert/show-devices 
**Package:** cmr
**Type:** Command

Lists the devices on which the state alert of an alert rule is active, with a status flag for each (see the following flags). Event alerts never stay active, so they list no devices.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="p" typ="remote-pending">Controller requests pairing.</ArgTableRow>
<ArgTableRow arg="I" typ="inactive">Device is inactive.</ArgTableRow>
<ArgTableRow arg="S" typ="stale">No connection (stale).</ArgTableRow>
<ArgTableRow arg="L" typ="controller">The CMR server itself (self-client).</ArgTableRow>
<ArgTableRow arg="C" typ="connected">Device is connected.</ArgTableRow>
<ArgTableRow arg="U" typ="upgrade-available">A newer update is available.</ArgTableRow>
</ArgTable>

<ArgTable c1="Argument" c2="Type" c3="Description">
<ArgTableRow arg="on-only" typ="bool">Show only the devices on which the alert rule is active.</ArgTableRow>
</ArgTable>
