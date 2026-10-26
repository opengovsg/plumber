import type { Transaction } from 'objection'

import { findIfThenBlockEndingAt } from '@/apps/toolbox/actions/if-then/infra/end-step-utils'
import { fixupEndStepOnCreateStep } from '@/apps/toolbox/actions/if-then/infra/handle-create-step'
import { findEnclosingIfThenV2Block } from '@/apps/toolbox/common/block-execution'
import {
  isForEachStep,
  isIfThenStep,
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import { upgradeIfThenV1BlocksIfEnabled } from '@/apps/toolbox/common/validate-end-step'
import { UserFacingError } from '@/errors/user-facing-error'
import Step from '@/models/step'
import type User from '@/models/user'
import { createActionStepCore } from '@/services/create-action-step'
import { lookupStepDefinition } from '@/services/step-definition'

import { PublishedPipeError } from './published-pipe-error'
import { createStepAiBuilderConfig } from './step-ai-builder-config'

export interface CreateStepApprovalBranchInput {
  branch: 'reject'
  stepId: string
}

export interface CreateStepInput {
  user: User
  pipeId: string
  appKey: string
  key: string
  previousStepId: string
  traceId?: string
  // Place the new step after the whole If block, not inside it.
  afterIfThenBlock?: boolean
  // Route the new step into the reject path of an MRF approval step.
  approvalBranch?: CreateStepApprovalBranchInput
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

/** Throws unless the app key and action key name a step the AI Builder may create. */
export function assertStepCreatable(appKey: string, key: string): void {
  const lookup = lookupStepDefinition(appKey, key)

  if (lookup.kind === 'unknown') {
    throw new Error('No such trigger or action')
  }

  if (lookup.kind === 'hidden') {
    throw new Error('Action can only be created by system')
  }
}

export async function createStepService(input: CreateStepInput): Promise<Step> {
  assertStepCreatable(input.appKey, input.key)

  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    return createStepInTransaction(trx, input)
  })
}

/**
 * The caller opens the transaction and sets it to SERIALIZABLE, so several
 * steps can be created in one.
 */
export async function createStepInTransaction(
  trx: Transaction,
  {
    user,
    pipeId,
    appKey,
    key,
    previousStepId,
    traceId,
    afterIfThenBlock = false,
    approvalBranch,
  }: CreateStepInput,
): Promise<Step> {
  const isIfThen = appKey === TOOLBOX_APP_KEY && key === TOOLBOX_ACTIONS.IF_THEN
  const isForEach =
    appKey === TOOLBOX_APP_KEY && key === TOOLBOX_ACTIONS.FOR_EACH

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

  // The new step joins the previous step's rejection branch unless the input
  // starts one. The first step of a reject path follows the approval step.
  const approval = approvalBranch
    ? { branch: approvalBranch.branch, stepId: approvalBranch.stepId }
    : previousStep.config?.approval

  // Publish allows one For-each on each approval branch.
  if (
    isForEach &&
    flowSteps.some(
      (step) =>
        isForEachStep(step) &&
        step.config?.approval?.branch === approval?.branch,
    )
  ) {
    throw new UserFacingError('A pipe can only have one For-each step.')
  }

  const step = await createActionStepCore({
    trx,
    flow,
    previousStep,
    appKey,
    key,
    parameters: isIfThen ? { depth: 0 } : {},
    config: {
      ...(approval && { approval }),
      ...(traceId && createStepAiBuilderConfig(traceId, 'create_step')),
    },
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
}
