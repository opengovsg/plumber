---
name: verify-toolbox-if-then
description: Check that Toolbox If, Repeat, and Delay placement rules agree on the same pipe. Use when a change touches where a toolbox action can be added, or an if-then block's end marker.
---

# Verify Toolbox placement

Toolbox actions share one pipe layout. The check asks, at every insertion point, whether If, Repeat, and Delay are allowed together.

## Property

On the if-then V2 model:

- An If block can be added anywhere except inside another If block.
- Repeat for each can be added only as the last step, only once, and not inside an If block.
- Delay cannot be added inside a Repeat body. Adding it on the Repeat step itself counts as inside that body.
- A launcher may say the new step lands inside an If block, or after the whole block, when the anchor step alone would say otherwise.

Inside an If block means strictly after that if-then and up to its end marker. An earlier If block consumes that range, so a Repeat inside it does not start its own body. A Repeat that is not inside an earlier block owns every later step.

The harm is a Repeat or a nested If landing where later steps run under the wrong condition, or a Delay waiting inside a Repeat.

A saved if-then end marker has its own rules. The end step stays in the pipe at or after the if-then. The block contains no MRF submission, stays on one rejection branch, and does not overlap another if-then block. An empty block may be saved. Publish rejects it.

## Run

From the repo root:

```bash
nvm use && pnpm --filter frontend exec vitest run src/components/FlowStepConfigurationModal/hooks/__tests__/toolbox-placement.critical.test.ts
nvm use && pnpm --filter backend exec vitest run src/apps/toolbox/__tests__/common/if-then-block-invariant.critical.test.ts
```

A pass means every generated pipe agreed with both rule sets. A failure prints one pipe and the If, Repeat, and Delay answers that disagreed, or one forbidden block marker.

## Bounds

Placement uses action lists of 1 to 4 steps. The trigger is already removed. Each step is a plain action, Delay, Only continue if, Repeat, or an If block whose end marker is on that step or a later one. Each list is checked at every anchor, with and without being the last step, and with each launcher override.

Block markers use pipes of 1 to 4 steps, including an MRF submission and two rejection branches. That check does not run a pipe.

Neither check covers whether an Only continue if condition is true, or where a legacy if-then without an end marker skips.

## Coverage

- `packages/frontend/src/components/FlowStepConfigurationModal/hooks/useIsAppSelectable.ts` function `getIfThenV2Selectability`.
- `packages/frontend/src/components/FlowStepConfigurationModal/helpers/anchor-placement.ts`.
- `packages/frontend/src/components/Editor/helpers/steps-utils.ts` functions `buildStepsList`, `isStepInsideIfThenBlock`, and `isStepInsideForEachBody`.
- `packages/backend/src/apps/toolbox/common/validate-end-step.ts` functions `checkEndStepWrite`, `validateEndStepWrite`, and `validateFlowBlocks`.

Sync commit: `00b53dc0`. The covered functions were last confirmed against that revision. Move this hash forward only after you re-read them and confirm the rules in this skill and in the two critical tests still describe them.

## How to read a failure

The failure names the pipe and the insertion point.

- The code allowed Repeat when the new step was not last, or allowed an If inside a block, and the comments in `useIsAppSelectable.ts` still state these rules. That is a bug. Report the pipe. Do not weaken the test.
- The code rejected a placement this skill allows, and a commit says the rule changed on purpose. Update the rule text here and in the test header. Then move the sync commit.
- A block-marker failure names a pipe that was accepted or rejected against `validate-end-step.ts`. Treat it the same way.
