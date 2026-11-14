---
sidebar_key: "cli-reference/cmr/upgrade/job/show-devices"
sidebar_position: 2
title: "show-devices"
sidebar_label: 'show-devices'
source: https://manual.mikrotik.com/docs/cli-reference/cmr/upgrade/job/show-devices
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## cmr/upgrade/job/show-devices 
**Package:** cmr
**Type:** Command

Shows the devices the selected job covers. A scheduled job resolves its device list only when the job starts, so the output for a job that has not started yet can be empty.

<ArgTable c1="Flag" c2="Name" c3="Description">
<ArgTableRow arg="L" typ="controller">Include the CMR server itself (self-client).</ArgTableRow>
</ArgTable>
