import { raw } from 'objection'

import { removeMrfSteps } from '@/apps/formsg/triggers/new-submission/remove-mrf-steps'
import { hasStepReference } from '@/helpers/check-step-parameters'
import Flow from '@/models/flow'
import Step from '@/models/step'
import type User from '@/models/user'

export interface DeleteStepInput {
  user: User
  pipeId: string
  stepId: string
}

export async function deleteStepService({
  user,
  pipeId,
  stepId,
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

    if (step.type === 'trigger') {
      if (step.appKey === 'formsg' && step.key === 'newSubmission') {
        await removeMrfSteps(flow.id, trx)
      }

      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', stepId)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([stepId]),
      )
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await step.$query(trx).delete()
      await flow.$relatedQuery('steps', trx).insert({
        key: null,
        appKey: null,
        type: 'trigger',
        position: 1,
        parameters: {},
        connectionId: null,
      })
    } else {
      const allSteps = await flow
        .$relatedQuery('steps', trx)
        .where('id', '!=', stepId)
        .orderBy('position', 'asc')

      const stepsToInvalidate = getStepsToInvalidate(
        allSteps,
        new Set([stepId]),
      )
      await Step.query(trx)
        .findByIds(stepsToInvalidate)
        .patch({ status: 'incomplete' })

      await Step.query(trx).findById(stepId).delete()

      await flow
        .$relatedQuery('steps', trx)
        .where('position', '>', step.position)
        .patch({ position: raw('position - 1') })
    }

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

function getStepsToInvalidate(
  steps: Step[],
  deletedIds: Set<string>,
): string[] {
  const stepsToInvalidate = []
  for (const s of steps) {
    if (hasStepReference(s.parameters, deletedIds)) {
      stepsToInvalidate.push(s.id)
    }
  }
  return stepsToInvalidate
}
