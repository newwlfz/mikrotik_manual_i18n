---
sidebar_key: "cli-reference/user/expire-password"
sidebar_position: 3
title: "expire-password"
sidebar_label: 'expire-password'
source: https://manual.mikrotik.com/docs/7.25/cli-reference/user/expire-password
captured_at: '2026-11-01T21:26:12+08:00'
---

-----------

## user/expire-password 
**Type:** Command

Expires the selected users' passwords (sets the `E` flag in [`/user`](/docs/7.25/cli-reference/user/)). At the next interactive login the user is asked to set a new password; setting a new password with `/user/set` also clears the flag. See [User](/docs/7.25/authentication-authorization-accounting/user) for the full guide.
