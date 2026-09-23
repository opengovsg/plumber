import App from '@/models/app'
import Step from '@/models/step'
import type User from '@/models/user'
import { createActionStepCore } from '@/services/create-action-step'

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
  approvalBranch?: CreateStepApprovalBranchInput
}

export async function createStepService({
  user,
  pipeId,
  appKey,
  key,
  previousStepId,
  approvalBranch,
}: CreateStepInput): Promise<Step> {
  const triggerOrAction = await App.findTriggerOrActionByKey(appKey, key)

  if (!triggerOrAction) {
    throw new Error('No such trigger or action')
  }

  // Hidden actions (e.g. FormSG's mrfSubmission) are system-managed and can
  // never be created directly by the AI Builder, approval-branch input or not.
  if (triggerOrAction.hiddenFromUser) {
    throw new Error('Action can only be created by system')
  }

  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const flow = await user
      .withAccessibleFlows({ requiredRole: 'editor', trx })
      .findOne({ id: pipeId })

    if (!flow) {
      throw new Error('Pipe not found')
    }

    const previousStep = await flow
      .$relatedQuery('steps', trx)
      .findOne({ id: previousStepId })

    if (!previousStep) {
      throw new Error('Previous step not found')
    }

    const step = await createActionStepCore({
      trx,
      flow,
      previousStep,
      appKey,
      key,
      config: approvalBranch
        ? {
            approval: {
              branch: approvalBranch.branch,
              stepId: approvalBranch.stepId,
            },
          }
        : {},
    })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    return step
  })
}
