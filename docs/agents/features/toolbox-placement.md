# Toolbox placement

The step picker disables Toolbox actions that a pipe's layout does not allow. A disabled option is greyed out, shows its reason on hover and adds nothing when chosen.

## Sub-features

- `placement-in-if` disables `If` and `Repeat for each item` inside an If block.
- `placement-after-block` allows `If`, `Repeat for each item` and `Delay` after an If block at the last step.
- `placement-in-repeat` disables `Delay` and a second `Repeat for each item` inside a Repeat body.

## How to get to it

- In the editor, choose `Add step` under the last step.
- Inside an If block, choose its `Add step`.
- Below an If block, choose `Add step after block`.

## Steps

Preconditions:

- A pipe from [Create a pipe](./create-pipe.md) is open in the editor.

- **Set the trigger.** Choose `Choose how you want your workflow to start`, then `Scheduler`, then `Schedule hourly`. Choose `Check step`, then `Close`. `1. Schedule hourly` is visible.
- **Add an If block.** Choose the `Add step` card. Choose `If`. Close the step panel. The block shows `IF` and `Add step after block`.
- **Inside the If block.** Choose the block's `Add step`. `If` and `Repeat for each item` are greyed out.
  - Hover `If`. `You cannot add an If block inside another If block` is visible.
  - Hover `Repeat for each item`. `Repeat cannot be used in an If block` is visible.
  - Choose `If`. The picker stays open and no step is added. Close the picker.
- **After the block.** Choose `Add step after block`. `If`, `Repeat for each item` and `Delay` are all enabled. Choose `Repeat for each item`. Close the step panel. The pipe shows `REPEAT`.
- **Inside the Repeat body.** Choose the `Add step` under `REPEAT`. `Delay` and `Repeat for each item` are greyed out. `If` is enabled.
- **Proof.** Capture the picker in each state, with the hovered reason visible.

## Gotchas

- The `Add step` card is the clickable control. The round `Add Step` button below it stays disabled until a step exists after the trigger.
- Disabled options lose keyboard focus. In an accessibility snapshot, they lack `tabindex`.
- `Delay` inside a Repeat body shows `This can only be used as the last step`. That reason is the default text, not a Delay rule. Do not report it as a regression.
- `Delay` is under `OTHERS` at the bottom of the picker. Scroll to see it.
- Unit tests in `useIsAppSelectable.test.ts` and `validate-end-step.test.ts` own the full rule matrix. This journey checks what a user sees.
