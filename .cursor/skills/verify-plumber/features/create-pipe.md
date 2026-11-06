# Create a pipe

Create a pipe lets a signed-in user name a workflow from the empty pipes page and see that name in the editor after a reload.

## Sub-features

- `create-choose-scratch` selects start from scratch.
- `create-save` stores the trimmed name and opens the editor.
- `create-reload` shows the same name after a fresh load.

## How to get to it (user POV)

- Sign in and land on the empty pipes page.
- Choose `Start from scratch`.

## Driving it with control-plumber

Preconditions:

- `control-plumber doctor` prints `healthy`.
- The signed-in user has no pipes. Follow [Sign in](./sign-in.md) on this instance first.
- The browser is on the empty pipes page. The heading `How do you want to create your workflow?` is visible.
- No announcement dialog covers the page. The harness closes that by setting local storage before navigation.

- **Choose scratch.** Choose `Start from scratch`. Run `control-plumber browser click --text "Start from scratch"`. The field labelled by placeholder `For e.g. track event feedback, send customised replies` is visible.
- **Name the pipe.** Type `Release checklist`. Run `control-plumber browser fill --placeholder "For e.g. track event feedback, send customised replies" --value "Release checklist"`. The `Next` button is enabled.
- **Save.** Choose `Next`. Run `control-plumber browser click --role button --name "Next"`. The text `Choose how you want your workflow to start` is visible and the pipe name `Release checklist` is visible. The URL path starts with `/editor/`.
- **Reload.** Reload the editor. Run `control-plumber browser reload`. The name `Release checklist` is still visible. The URL path still starts with `/editor/`.
- **Proof.** Capture the reloaded editor. Run `control-plumber browser snapshot --path create-pipe/editor.aria.txt` and `control-plumber browser screenshot --path create-pipe/editor.png`. Both show `Release checklist` and `Choose how you want your workflow to start`.

## Gotchas

- The empty page has no `Create pipe` button. That button appears only after the first pipe exists.
- `Build with AI` and `Use a template` leave this recipe. Do not treat those screens as a created pipe.
- The name is trimmed. Assert the editor text, not the draft field.
- A heading alone is not persistence. Reload the editor URL before the proof screenshot.
- The announcement dialog blocks the page when local storage is empty. The browser helper sets `announcement-modal-last-opened` to the value in `packages/frontend/src/components/AnnouncementModal/constants.ts`. If the dialog still appears, that constant changed.
