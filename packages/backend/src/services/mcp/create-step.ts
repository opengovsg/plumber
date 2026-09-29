import { raw } from 'objection'

import { fixupEndStepOnCreateStep } from '@/apps/toolbox/actions/if-then/infra/handle-create-step'
import { findEnclosingIfThenV2Block } from '@/apps/toolbox/common/block-execution'
import {
  BLOCK_END_STEP_ID,
  isForEachStep,
  isIfThenStep,
  isIfThenV2,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { upgradeIfThenV1BlocksIfEnabled } from '@/apps/toolbox/common/validate-end-step'
import { UserFacingError } from '@/errors/user-facing-error'
import { getStepVersion } from '@/helpers/get-step-version'
import App from '@/models/app'
import Step from '@/models/step'
import type User from '@/models/user'

import { PublishedPipeError } from './published-pipe-error'

export interface CreateStepInput {
  user: User
  pipeId: string
  appKey: string
  key: string
  previousStepId: string
  // Place the new step after the whole If block, not inside it.
  afterIfThenBlock?: boolean
}

/** `step` must be the block's If step or its last inner step. */
function findIfThenBlockEndingAt(
  flowSteps: Step[],
  step: Step,
): { ifThenStep: Step; endStep: Step } | null {
  const ifThenStep = flowSteps.find(
    (candidate) =>
      isIfThenV2(candidate) &&
      (candidate.id === step.id ||
        candidate.config[BLOCK_END_STEP_ID] === step.id),
  )
  if (!ifThenStep) {
    return null
  }
  const endStep = flowSteps.find(
    (candidate) => candidate.id === ifThenStep.config[BLOCK_END_STEP_ID],
  )
  return endStep ? { ifThenStep, endStep } : null
}

/** Inserting after the If step itself lands inside its block. */
function isInsertInsideIfThenBlock(
  flowSteps: Step[],
  previousStep: Step,
): boolean {
  return (
    isIfThenStep(previousStep) ||
    findEnclosingIfThenV2Block(flowSteps, previousStep) !== null
  )
}

export async function createStepService({
  user,
  pipeId,
  appKey,
  key,
  previousStepId,
  afterIfThenBlock = false,
}: CreateStepInput): Promise<Step> {
  const triggerOrAction = await App.findTriggerOrActionByKey(appKey, key)

  if (!triggerOrAction) {
    throw new Error('No such trigger or action')
  }

  if (triggerOrAction.hiddenFromUser) {
    throw new Error('Action can only be created by system')
  }

  const isIfThen = appKey === TOOLBOX_APP_KEY && key === TOOLBOX_ACTIONS.IF_THEN
  const isForEach =
    appKey === TOOLBOX_APP_KEY && key === TOOLBOX_ACTIONS.FOR_EACH

  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const flow = await user
      .withAccessibleFlows({ requiredRole: 'editor', trx })
      .findOne({ id: pipeId })

    if (!flow) {
      throw new Error('Pipe not found')
    }

    if (flow.active) {
      throw new PublishedPipeError()
    }

    // Legacy If blocks have no end marker, so pin them before placing the step.
    await upgradeIfThenV1BlocksIfEnabled(
      trx,
      flow,
      await flow.$relatedQuery('steps', trx).orderBy('position', 'asc'),
    )

    const flowSteps = await flow
      .$relatedQuery('steps', trx)
      .orderBy('position', 'asc')

    let previousStep = flowSteps.find((step) => step.id === previousStepId)
    if (!previousStep) {
      throw new Error('Previous step not found')
    }

    let previousBlockId: string | undefined
    if (afterIfThenBlock) {
      const block = findIfThenBlockEndingAt(flowSteps, previousStep)
      if (!block) {
        throw new UserFacingError(
          'after_if_then_block needs previous_step_id to be an If step or the last step inside its If block.',
        )
      }
      previousBlockId = block.ifThenStep.id
      previousStep = block.endStep
    } else if (isInsertInsideIfThenBlock(flowSteps, previousStep)) {
      if (isIfThen) {
        throw new UserFacingError(
          'An If block cannot contain another If. Pass after_if_then_block: true to add it after the current block instead.',
        )
      }
      if (isForEach) {
        throw new UserFacingError(
          'An If block cannot contain a For-each. Pass after_if_then_block: true to add it after the current block instead.',
        )
      }
    }

    if (isForEach && flowSteps.some((step) => isForEachStep(step))) {
      throw new UserFacingError('A pipe can only have one For-each step.')
    }

    const newStepPosition = previousStep.position + 1

    await flow
      .$relatedQuery('steps', trx)
      .patch({ position: raw('position + 1') })
      .where('position', '>=', newStepPosition)

    const version = getStepVersion(appKey, key)

    const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
      key,
      appKey,
      type: 'action',
      position: newStepPosition,
      parameters: isIfThen ? { depth: 0 } : {},
      version,
    })

    // A new If starts as an empty block that later inserts extend.
    await fixupEndStepOnCreateStep({
      trx,
      flow,
      previousBlockId,
      previousStep,
      newStep: step,
      wantsSelfEndStep: isIfThen,
    })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    // Re-read so a new If's marker is part of the returned step.
    return Step.query(trx).findById(step.id).throwIfNotFound()
  })
}
