import { raw } from 'objection'

import { getStepVersion } from '@/helpers/get-step-version'
import App from '@/models/app'
import Step from '@/models/step'
import type User from '@/models/user'

export interface CreateStepInput {
  user: User
  pipeId: string
  appKey: string
  key: string
  previousStepId?: string
}

export async function createStepService({
  user,
  pipeId,
  appKey,
  key,
  previousStepId,
}: CreateStepInput): Promise<Step> {
  const triggerOrAction = await App.findTriggerOrActionByKey(appKey, key)

  if (!triggerOrAction) {
    throw new Error('No such trigger or action')
  }

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

    let newStepPosition: number

    if (previousStepId) {
      const previousStep = await flow
        .$relatedQuery('steps', trx)
        .findOne({ id: previousStepId })

      if (!previousStep) {
        throw new Error('Previous step not found')
      }

      newStepPosition = previousStep.position + 1
    } else {
      const lastStep = await flow
        .$relatedQuery('steps', trx)
        .orderBy('position', 'desc')
        .first()

      newStepPosition = lastStep ? lastStep.position + 1 : 2
    }

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
      parameters: {},
      version,
    })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    return step
  })
}
