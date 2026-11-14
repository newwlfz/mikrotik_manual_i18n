---
sidebar_key: "cli-reference/cmr/upgrade/trigger"
sidebar_position: 3
title: "trigger"
sidebar_label: 'trigger'
source: https://manual.mikrotik.com/docs/cli-reference/cmr/upgrade/trigger
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## cmr/upgrade/trigger 
**Package:** cmr
**Type:** Command

Starts the job of a chosen rule right away, without waiting for the schedule-time. Only one upgrade job runs at a time; triggering another rule while a job is in progress places the new job in a [queued state](/docs/cli-reference/cmr/upgrade/job#cmr-upgrade-job) until the current job finishes.

Triggering forces an early upgrade of the rule's covered devices: the job runs immediately and upgrades each covered device that has a newer version available, without waiting for the schedule-time. Covered devices that are already up to date are skipped, so the run's counter counts only the upgraded ones. To upgrade a single device regardless of its rule, see [`/cmr/device/upgrade`](/docs/cli-reference/cmr/device/upgrade).
