---
title: "generate-new-id"
source: https://manual.mikrotik.com/docs/7.25/cli-reference/system/license/generate-new-id
captured_at: '2026-11-28T10:17:19.424Z'
pagination_prev: "cli-reference/system/license"
---

-----------

## system/license/generate-new-id 
**Syscap:** chr
**Type:** Command

Generates a new unique system ID for a CHR instance. Use after the first boot and before requesting a trial license when deploying multiple CHR instances from the same disk image to avoid identical system IDs.

:::warning
This command must only be used on a CHR running the Free license level. Do not use it after a trial or paid license has been applied.
:::
