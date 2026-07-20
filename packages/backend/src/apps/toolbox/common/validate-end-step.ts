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

// Loose enough for unit tests to pass partial objects instead of full Step
// rows.
type ValidationStep = StepLike & Pick<IStep, 'id' | 'position'>

interface EndStepWriteValidationArgs {
  // IMPORTANT: must already reflect the mutation's own insert/patch, ordered
  // by position ascending.
  flowSteps: ValidationStep[]
  ifThenStepId: string
  endStepId: string
  flowId: string
}

/**
 * IMPORTANT: throws a plain Error, not BadUserInputError — these violations
 * are prevented by the frontend, so hitting one means a bug, not bad input.
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
 * Enforces every endStepId write invariant; throws and logs
 * `end-step-write-rejected` on violation, rolling back the mutation.
 *
 * Exported for unit coverage — mutations should go through
 * `validateEndStepOn{Create,Update}Step` below instead.
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

  // IMPORTANT: a block that crosses this boundary would jump execution into
  // or out of a branch on FALSE.
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

  // Nesting is never legitimate (depth === 0), so no two ranges may overlap.
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

// Uses jsonb_set so this only touches endStepId, not the rest of config.
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
 * transaction as the insert.
 *
 * IMPORTANT: throws on any violation, rolling back the whole creation.
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

  if (previousBlockId != null) {
    const blockStep = flowSteps.find((step) => step.id === previousBlockId)
    if (!blockStep || !isIfThenStep(blockStep)) {
      rejectEndStepWrite('previous-block-not-if-then', {
        previousBlockId,
        flowId,
      })
    }

    // Already marked: nothing to pin here, this check is just a bug tripwire.
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

    // Excludes the new step from the extent scan so a plain add-after isn't
    // absorbed into the block.
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
 * Validates a client-supplied config.endStepId on updateStep.
 *
 * Accepted only when the key is present — an absent key is preserved by the
 * caller's config spread. Throws (rolling back the transaction) on an invalid
 * target.
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
