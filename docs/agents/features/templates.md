# Templates

Templates lists pre-built pipes a signed-in user can open.

## Sub-features

- `templates-open` shows the title and description.
- `templates-list` shows at least one template from the server.

## How to get to it

- Choose `Templates` in the sidebar.
- Open `/templates`.

## Steps

Preconditions:

- The user is signed in. Follow [Sign in](./sign-in.md).

- **Sidebar.** Choose the link `Templates`. The description `Pre-built pipes that you can use as is or customise further for your own use case` is visible.
- **Direct URL.** Go to `/templates`. The same description is visible.
- **List.** Wait for the text `Track feedback`. It is visible.
- **Proof.** Capture the page. It shows `Templates` and `Track feedback`.

## Gotchas

- Narrow windows show sidebar icons without labels. Keep the window at least 1280 px wide.
- Template search waits half a second before it filters.
- LaunchDarkly can hide some templates. Assert a name you can see, not a fixed id.
- Opening a template starts another journey. Stop on the list.
