# Executions

Executions shows a user's pipe runs. A user with no pipes is told to create one.

## Sub-features

- `executions-empty` shows `Create a pipe to see executions` for a user with no pipes.
- `executions-open` opens the page from the sidebar and from the URL.

## How to get to it

- Choose `Executions` in the sidebar.
- Open `/executions`.

## Steps

Preconditions:

- The user has no pipes. Follow [Sign in](./sign-in.md) with a new email. Do not reuse the user from [Create a pipe](./create-pipe.md).

- **Sidebar.** Choose the link `Executions`. `Create a pipe to see executions` is visible.
- **Direct URL.** Go to `/executions`. The same text is visible.
- **Proof.** Capture the page. It shows `Create a pipe to see executions`.

## Gotchas

- `Select a pipe to view executions` appears only for a user with at least one pipe. Do not assert it here.
- Narrow windows show sidebar icons without labels. Keep the window at least 1280 px wide.
