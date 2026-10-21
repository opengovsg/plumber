import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'
import { deleteStepsInTransaction } from '@/services/delete-steps'

import { PublishedPipeError } from './published-pipe-error'

export interface DeleteStepInput {
  user: User
  pipeId: string
  stepId: string
  traceId?: string
}

export async function deleteStepService({
  user,
  pipeId,
  stepId,
  traceId,
}: DeleteStepInput): Promise<Flow> {
  return Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const step = await user
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .findOne({ 'steps.id': stepId, 'steps.flow_id': pipeId })

    if (!step) {
      throw new Error('Step not found')
    }

    const flow = step.flow

    if (flow.active) {
      throw new PublishedPipeError()
    }

    await deleteStepsInTransaction({
      trx,
      flow,
      stepIds: [stepId],
      traceId,
      includeLegacyIfBlockMembers: true,
    })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: user.id,
      trx,
    })

    return flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}
