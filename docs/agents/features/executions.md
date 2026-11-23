# Executions

Executions asks a signed-in user to pick a pipe. A user with no pipes is told to create one.

## Sub-features

- `executions-empty` shows the empty text for a user with no pipes.
- `executions-open` opens the page from the sidebar and from the URL.

## How to get to it

- Choose `Executions` in the sidebar.
- Open `/executions`.

## Steps

Preconditions:

- The user has no pipes. Follow [Sign in](./sign-in.md) with a new email. Do not reuse the user from [Create a pipe](./create-pipe.md).

- **Sidebar.** Choose the link `Executions`. `Select a pipe to view executions` and `Create a pipe to see executions` are visible.
- **Direct URL.** Go to `/executions`. The same two strings are visible.
- **Proof.** Capture the page. It shows both strings.

## Gotchas

- The empty text disappears once the user has a pipe.
- Narrow windows show sidebar icons without labels. Keep the window at least 1280 px wide.
