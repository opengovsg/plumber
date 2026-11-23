# Create a pipe

Create a pipe lets a signed-in user name a pipe from the empty pipes page. The name persists after a reload.

## Sub-features

- `create-choose-scratch` selects start from scratch.
- `create-save` stores the trimmed name and opens the editor.
- `create-reload` shows the same name after a reload.

## How to get to it

- Sign in as a new user and land on the empty pipes page.
- Choose `Start from scratch`.

## Steps

Preconditions:

- The user has no pipes. Follow [Sign in](./sign-in.md) with a new email.
- The announcement dialog is closed. The heading `How do you want to create your workflow?` is visible.

- **Choose scratch.** Choose `Start from scratch`. The field with placeholder `For e.g. track event feedback, send customised replies` is visible.
- **Name the pipe.** Fill that field with `Release checklist`. The button `Next` is enabled.
- **Save.** Choose `Next`. The URL path starts with `/editor/`. `Release checklist` and `Choose how you want your workflow to start` are visible.
- **Reload.** Reload the page. The URL path still starts with `/editor/`, and `Release checklist` is still visible.
- **Proof.** Capture the reloaded editor. It shows `Release checklist` and `Choose how you want your workflow to start`.

## Gotchas

- The empty page has no `Create pipe` button. It appears only after the first pipe exists.
- `Build with AI` and `Use a template` start other journeys. AI Builder cannot reach Bedrock on placeholders.
- The name is trimmed. Assert the editor text, not the field.
- A heading alone does not prove the save. Reload before the proof.
- The announcement dialog returns until `announcement-modal-last-opened` in local storage equals `LATEST_ANNOUNCEMENT_MODAL_TIMESTAMP`. That constant is in `packages/frontend/src/components/AnnouncementModal/constants.ts`.
