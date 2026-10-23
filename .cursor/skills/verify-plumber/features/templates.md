# Templates

Templates lists pre-built pipes a signed-in user can open.

## Sub-features

- `templates-open` shows the templates title and the short description.
- `templates-list` shows at least one template name from the server.

## How to get to it (user POV)

- Choose `Templates` in the sidebar.
- Open `/templates`.

## Driving it with control-plumber

Preconditions:

- `control-plumber doctor` prints `healthy`.
- Follow [Sign in](./sign-in.md) on this instance first.
- The window is wide enough that sidebar labels are visible. The harness uses 1280 by 900.

- **Sidebar.** Choose `Templates`. Run `control-plumber browser click --role link --name "Templates"`. The text `Templates` is visible and the description `Pre-built pipes that you can use as is or customise further for your own use case` is visible.
- **Direct URL.** Open the route. Run `control-plumber browser goto /templates`. The same description is visible.
- **List.** Wait for a built-in template. Run `control-plumber browser wait --text "Track feedback"`. That name is visible.
- **Proof.** Run `control-plumber browser snapshot --path templates/list.aria.txt` and `control-plumber browser screenshot --path templates/list.png`. Both show `Templates` and that template name.

## Gotchas

- Below the large breakpoint the sidebar hides the words and shows icons only. Do not shrink the window.
- Template search waits half a second. This recipe does not search.
- LaunchDarkly can hide one of the two support-enquiry templates. Assert a name you can see, not a fixed id.
- Opening a template starts a different flow. Stop on the list for this feature.
