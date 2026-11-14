# Executions

Executions asks a signed-in user to pick a pipe. With no pipes it tells them to create one.

## Sub-features

- `executions-empty` shows the empty copy when the user has no pipes.
- `executions-open` reaches that page from the sidebar and from the URL.

## How to get to it (user POV)

- Choose `Executions` in the sidebar.
- Open `/executions`.

## Driving it with control-plumber

Preconditions:

- `control-plumber doctor` prints `healthy`.
- Follow [Sign in](./sign-in.md) on a user who has not created a pipe.
- Do not run this after [Create a pipe](./create-pipe.md) on the same user. That user no longer has an empty list.

- **Sidebar.** Choose `Executions`. Run `control-plumber browser click --role link --name "Executions"`. The text `Select a pipe to view executions` is visible and the text `Create a pipe to see executions` is visible.
- **Direct URL.** Run `control-plumber browser goto /executions`. The same two strings are visible.
- **Proof.** Run `control-plumber browser snapshot --path executions/empty.aria.txt` and `control-plumber browser screenshot --path executions/empty.png`. Both show those two strings.

## Gotchas

- This page does not run a pipe. The worker is not part of `launch`.
- After a pipe exists, the empty sentence disappears. Use a user with no pipes.
- Sidebar labels need the wide window from `launch`.
