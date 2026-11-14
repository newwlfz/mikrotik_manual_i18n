---
sidebar_key: "cli-reference/user/expire-password"
sidebar_position: 3
title: "expire-password"
sidebar_label: 'expire-password'
source: https://manual.mikrotik.com/docs/cli-reference/user/expire-password
captured_at: '2026-11-09T11:35:47.715Z'
---

-----------

## user/expire-password 
**Type:** Command

Expires the selected users' passwords (sets the `E` flag in [`/user`](/docs/cli-reference/user/)). At the next interactive login the user is asked to set a new password; setting a new password with `/user/set` also clears the flag. See [User](/docs/authentication-authorization-accounting/user) for the full guide.
