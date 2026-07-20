import type { IStep } from '@plumber/types'

import { raw, Transaction } from 'objection'

import { deriveIfThenV1EndStep } from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import logger from '@/helpers/logger'
import Flow from '@/models/flow'
import Step from '@/models/step'

import {
  BLOCK_END_STEP_ID,
  isBlockStep,
  isIfThenStep,
  isIfThenV2,
  type StepLike,
} from './constants'

// StepLike (appKey/key/config, all optional) plus id/position, which the
// validator uses directly. Real Objection `Step` rows satisfy it; unit tests
// pass partial plain objects.
type ValidationStep = StepLike & Pick<IStep, 'id' | 'position'>

interface EndStepWriteValidationArgs {
  // Flow steps ordered by position ascending, reflecting the final positions
  // after any insert/patch the mutation has already applied.
  flowSteps: ValidationStep[]
  // The if-then receiving the marker.
  ifThenStepId: string
  // The endStepId value being written.
  endStepId: string
  flowId: string
}

/**
 * Logs a structured rejection and throws a plain Error so the enclosing
 * transaction rolls back. These states are prevented by the frontend, so a
 * violation is a bug — not user input (hence a plain Error, not
 * BadUserInputError).
 */
function rejectEndStepWrite(
  reason: string,
  details: Record<string, unknown>,
): never {
  logger.error({ event: 'end-step-write-rejected', reason, ...details })
  throw new Error(`endStepId write rejected: ${reason}`)
}

function isMrfSubmissionStep(step: ValidationStep): boolean {
  return step.appKey === 'formsg' && step.key === 'mrfSubmission'
}

/**
 * Which MRF rejection branch a step belongs to, or null for the main flow.
 * `config.approval` is only ever written for rejection branches (its `branch`
 * is typed `'reject'`), so its `stepId` — the approval step the branch hangs
 * off — identifies the branch on its own.
 */
function getRejectionBranchId(step: ValidationStep): string | null {
  return step.config?.approval?.stepId ?? null
}

/**
 * Enforces every invariant an if-then V2 endStepId write must satisfy: the
 * target is a toolbox/ifThen in this flow; the endStep exists and sits at/after
 * it; the block region `(ifThen, end]` holds no mrfSubmission and stays within
 * the if-then's own MRF region (the main flow, or one rejection branch); and the
 * block does not overlap another if-then V2 block. Violations log
 * `end-step-write-rejected` and throw, rolling back the mutation. Exported for
 * unit coverage; mutations should call the `validateEndStepOn{Create,Update}Step`
 * helpers below.
 */
export function validateEndStepWrite({
  flowSteps,
  ifThenStepId,
  endStepId,
  flowId,
}: EndStepWriteValidationArgs): void {
  const ifThenStep = flowSteps.find((step) => step.id === ifThenStepId)

  // Target must be a toolbox/ifThen present in this flow.
  if (!ifThenStep || !isIfThenStep(ifThenStep)) {
    rejectEndStepWrite('target-not-if-then', { ifThenStepId, flowId })
  }

  // endStep must exist in the same flow.
  const endStep = flowSteps.find((step) => step.id === endStepId)
  if (!endStep) {
    rejectEndStepWrite('end-step-not-in-flow', {
      ifThenStepId,
      endStepId,
      flowId,
    })
  }

  // endStep must be at or after the if-then (self-ref is the empty block).
  if (endStep.position < ifThenStep.position) {
    rejectEndStepWrite('end-step-before-self', {
      ifThenStepId,
      endStepId,
      endStepPosition: endStep.position,
      ifThenPosition: ifThenStep.position,
      flowId,
    })
  }

  // Region confinement: the block must live inside one MRF region. It may hold
  // no mrfSubmission, and every step in it must sit in the same place in the
  // MRF structure as the if-then — all in the main flow, or all in the same
  // rejection branch. A block that crossed that boundary would jump execution
  // into or out of a branch on FALSE.
  const blockRejectionBranchId = getRejectionBranchId(ifThenStep)
  for (const step of flowSteps) {
    if (
      step.position <= ifThenStep.position ||
      step.position > endStep.position
    ) {
      continue
    }
    if (isMrfSubmissionStep(step)) {
      rejectEndStepWrite('mrf-step-in-region', {
        ifThenStepId,
        endStepId,
        offendingStepId: step.id,
        flowId,
      })
    }
    if (getRejectionBranchId(step) !== blockRejectionBranchId) {
      rejectEndStepWrite('approval-branch-crossed', {
        ifThenStepId,
        endStepId,
        offendingStepId: step.id,
        blockRejectionBranchId,
        offendingRejectionBranchId: getRejectionBranchId(step),
        flowId,
      })
    }
  }

  // Pairwise disjointness: the new range [ifThen, end] must not overlap any
  // other if-then V2 block's range. Nesting is never legitimate (depth === 0).
  for (const other of flowSteps) {
    if (other.id === ifThenStepId || !isIfThenV2(other)) {
      continue
    }
    const otherEnd = flowSteps.find(
      (step) => step.id === other.config?.[BLOCK_END_STEP_ID],
    )
    // Skip pre-existing dangling markers — out of scope for this write.
    if (!otherEnd) {
      continue
    }
    const overlaps =
      ifThenStep.position <= otherEnd.position &&
      other.position <= endStep.position
    if (overlaps) {
      rejectEndStepWrite('overlapping-blocks', {
        ifThenStepId,
        endStepId,
        otherIfThenStepId: other.id,
        flowId,
      })
    }
  }
}

// Surgically sets config.endStepId in-transaction, preserving other config keys.
async function pinEndStep(
  trx: Transaction,
  ifThenStepId: string,
  endStepId: string,
): Promise<void> {
  await Step.query(trx)
    .findById(ifThenStepId)
    .patch({
      config: raw(`jsonb_set(config, '{${BLOCK_END_STEP_ID}}', ?::jsonb)`, [
        JSON.stringify(endStepId),
      ]),
    })
}

/**
 * Maintains if-then endStepId markers when a step is created, in the same
 * transaction as the insert. A new step is placed either AFTER a block (the
 * client signals which via previousBlockId) or somewhere plain:
 *
 *   - Added AFTER a block (previousBlockId set): the block's endStep must be the
 *     step the new one follows. A marker-less (V1) block is lazily upgraded by
 *     pinning it to its derived extent so the new step lands outside; an already
 *     marked block needs no write (the check is just a bug tripwire).
 *   - A plain step added at a marked block's tail (previousBlockId absent):
 *     extend that block to include it — this also covers first-add into an empty
 *     (self-referencing) block. A new if-then/for-each is never absorbed.
 *
 * Any violation throws (rolling back the whole creation).
 */
export async function validateEndStepOnCreateStep({
  trx,
  flow,
  previousBlockId,
  previousStep,
  newStep,
}: {
  trx: Transaction
  flow: Flow
  previousBlockId: string | null | undefined
  previousStep: Step
  newStep: Step
}): Promise<void> {
  const flowId = flow.id
  const flowSteps = await flow
    .$relatedQuery('steps', trx)
    .orderBy('position', 'asc')

  // Added AFTER a block.
  if (previousBlockId != null) {
    const blockStep = flowSteps.find((step) => step.id === previousBlockId)
    if (!blockStep || !isIfThenStep(blockStep)) {
      rejectEndStepWrite('previous-block-not-if-then', {
        previousBlockId,
        flowId,
      })
    }

    // Already-marked block: nothing to pin; verify previousStep is its endStep.
    if (isIfThenV2(blockStep)) {
      const explicitEndStepId = blockStep.config[BLOCK_END_STEP_ID]
      if (previousStep.id !== explicitEndStepId) {
        rejectEndStepWrite('previous-step-not-block-end', {
          previousBlockId,
          previousStepId: previousStep.id,
          endStepId: explicitEndStepId,
          flowId,
        })
      }
      return
    }

    // Marker-less (V1) block: derive its extent from the pre-insert order
    // (exclude the new step so a plain add-after isn't absorbed), then pin it.
    const preInsertSteps = flowSteps.filter((step) => step.id !== newStep.id)
    const preBlockStep = preInsertSteps.find(
      (step) => step.id === previousBlockId,
    )
    const derivedEndStep = deriveIfThenV1EndStep(preInsertSteps, preBlockStep)
    if (previousStep.id !== derivedEndStep.id) {
      rejectEndStepWrite('previous-step-not-block-end', {
        previousBlockId,
        previousStepId: previousStep.id,
        endStepId: derivedEndStep.id,
        flowId,
      })
    }
    validateEndStepWrite({
      flowSteps,
      ifThenStepId: blockStep.id,
      endStepId: derivedEndStep.id,
      flowId,
    })
    await pinEndStep(trx, blockStep.id, derivedEndStep.id)
    return
  }

  // Plain step added at a marked block's tail: extend that block.
  if (!isBlockStep(newStep)) {
    const blockToExtend = flowSteps.find(
      (step) =>
        isIfThenV2(step) && step.config[BLOCK_END_STEP_ID] === previousStep.id,
    )
    if (blockToExtend) {
      validateEndStepWrite({
        flowSteps,
        ifThenStepId: blockToExtend.id,
        endStepId: newStep.id,
        flowId,
      })
      await pinEndStep(trx, blockToExtend.id, newStep.id)
    }
  }
}

/**
 * Validates a client-supplied config.endStepId on updateStep and returns the
 * config fragment to merge. The marker is accepted only when the key is present
 * (an absent key is preserved by the caller's config spread); the write is
 * validated against the flow's steps in the same transaction, so an invalid
 * target throws and rolls back before anything is persisted.
 */
export async function validateEndStepOnUpdateStep({
  trx,
  step,
  inputConfig,
  flowId,
}: {
  trx: Transaction
  step: Step
  inputConfig: { [BLOCK_END_STEP_ID]?: string | null } | null | undefined
  flowId: string
}): Promise<{ [BLOCK_END_STEP_ID]?: string }> {
  if (!inputConfig || !Object.hasOwn(inputConfig, BLOCK_END_STEP_ID)) {
    return {}
  }

  const endStepId = inputConfig[BLOCK_END_STEP_ID] as string
  const flowSteps = await Step.query(trx)
    .where('flow_id', flowId)
    .orderBy('position', 'asc')
  validateEndStepWrite({ flowSteps, ifThenStepId: step.id, endStepId, flowId })
  return { [BLOCK_END_STEP_ID]: endStepId }
}
