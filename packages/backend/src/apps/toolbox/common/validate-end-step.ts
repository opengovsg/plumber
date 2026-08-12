import type { IStep } from '@plumber/types'

import logger from '@/helpers/logger'

import {
  BLOCK_END_STEP_ID,
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
