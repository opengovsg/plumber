---
name: verify-toolbox-if-then
description: Check that Toolbox if-then blocks in a Plumber pipe obey the end-marker rules. Use when a change touches if-then end markers, block ranges, or publish validation for toolbox actions.
---

# Verify Toolbox if-then blocks

A Toolbox if-then block marks where its steps end. A false condition skips to the step after that end. A bad marker skips into another branch or across an MRF submission.

## Property

A saved if-then end marker is allowed only when all of these hold.

- The marked step is a toolbox if-then in this pipe.
- The end step is in this pipe and sits at or after the if-then.
- No MRF submission sits inside the block. The inside is every step after the if-then, up to and including the end step.
- Every step inside the block is on the same MRF rejection branch as the if-then.
- The block does not overlap another if-then block whose end marker resolves. A dangling end marker on that other block is not an overlap.

An empty block, whose end marker is the if-then itself, may be saved. Publish rejects it. Publish checks only if-then steps that carry an `endStepId` key.

The harm is a false condition jumping into the wrong steps.

## Run

From the repo root:

```bash
nvm use && pnpm --filter backend exec vitest run src/apps/toolbox/__tests__/common/if-then-block-invariant.critical.test.ts
```

A pass means every generated pipe agreed with the rules above. A failure prints one pipe and whether the code accepted a forbidden block or rejected an allowed one.

## Bounds

The check builds every pipe of 1 to 4 steps. Each step is a plain action, an MRF submission, a legacy if-then, or an if-then with an end marker. The marker points at a step in the pipe or at a missing id. Each step is on the main flow or on one of two rejection branches. Steps are ordered by position.

The check calls `validateEndStepWrite` and `validateFlowBlocks`. It does not run a pipe. It does not cover for-each, the truth of an only-continue-if condition, or where a legacy if-then skips.

## Coverage

- `packages/backend/src/apps/toolbox/common/validate-end-step.ts` functions `checkEndStepWrite`, `validateEndStepWrite`, and `validateFlowBlocks`.
- `packages/backend/src/apps/toolbox/common/constants.ts` functions `isIfThenStep`, `isIfThenV2`, `isMrfSubmissionStep`, and `getRejectionBranchId`. The test states those definitions itself, so a change to them is visible.

Sync commit: `00b53dc0`. The covered functions were last confirmed against that revision. Move this hash forward only after you re-read them and confirm the rules in this skill and in `if-then-block-invariant.critical.test.ts` still describe them.

## How to read a failure

The failure names the pipe. Read `checkEndStepWrite` for that shape.

- The code accepted a block this skill forbids, and the comments in `validate-end-step.ts` still state these rules. That is a bug. Report the pipe. Do not weaken the test.
- The code rejected a block this skill allows, and a commit says the rule changed on purpose. Update the rule text here and in the test header. Then move the sync commit.
- The code changed and the test's step words no longer match `constants.ts`. Update the test's definitions to the new code, rerun, and then decide bug or intended change.
