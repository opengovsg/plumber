import { Transaction } from 'objection'

import {
  BLOCK_END_STEP_ID,
  isBlockStep,
  isIfThenStep,
  isIfThenV2,
} from '@/apps/toolbox/common/constants'
import {
  deriveV1EndStepDroppingBlankMembers,
  pinEndStep,
  rejectEndStepWrite,
  validateEndStepWrite,
} from '@/apps/toolbox/common/validate-end-step'
import Flow from '@/models/flow'
import type Step from '@/models/step'

import { deriveIfThenV1EndStep } from './end-step-utils'

/**
 * Maintains if-then endStepId markers when a step is created, in the same
 * transaction as the insert.
 *
 * IMPORTANT: throws on any violation, rolling back the whole creation.
 */
export async function fixupEndStepOnCreateStep({
  trx,
  flow,
  previousBlockId,
  previousStep,
  newStep,
  wantsSelfEndStep,
}: {
  trx: Transaction
  flow: Flow
  previousBlockId: string | null | undefined
  previousStep: Step
  newStep: Step
  wantsSelfEndStep: boolean
}): Promise<void> {
  const flowId = flow.id
  const flowSteps = await flow
    .$relatedQuery('steps', trx)
    .orderBy('position', 'asc')

  // Self-ref is independent of previousBlockId/tail-extend below: it's about
  // the new step's own marker, not an existing block's.
  if (wantsSelfEndStep) {
    if (!isIfThenStep(newStep)) {
      rejectEndStepWrite('self-end-step-on-non-if-then', {
        newStepId: newStep.id,
        flowId,
      })
    }
    validateEndStepWrite({
      flowSteps,
      ifThenStepId: newStep.id,
      endStepId: newStep.id,
      flowId,
    })
    await pinEndStep(trx, newStep.id, newStep.id)
  }

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

    // Drops any leftover V1 blank placeholder member before pinning, same as
    // the opportunistic upgrade pass. The new step is excluded from the
    // re-derivation for the same reason as above.
    const { endStep: finalEndStep, cleaned } =
      await deriveV1EndStepDroppingBlankMembers(
        trx,
        flow,
        preInsertSteps,
        preBlockStep,
        new Set([newStep.id]),
      )
    const finalFlowSteps = cleaned
      ? await flow.$relatedQuery('steps', trx).orderBy('position', 'asc')
      : flowSteps

    validateEndStepWrite({
      flowSteps: finalFlowSteps,
      ifThenStepId: blockStep.id,
      endStepId: finalEndStep.id,
      flowId,
    })
    await pinEndStep(trx, blockStep.id, finalEndStep.id)
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
