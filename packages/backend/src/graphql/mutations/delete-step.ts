import { NotFoundError } from 'objection'

import Step from '@/models/step'
import { loadAccessibleSteps } from '@/services/access'
import { deleteStepsInTransaction } from '@/services/delete-steps'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteStep: MutationResolvers['deleteStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (input.ids.length === 0) {
    throw new Error('Nothing to delete')
  }

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')
    // Include SELECTs in transaction too just in case there's concurrent modification.
    const steps = await loadAccessibleSteps({
      user: context.currentUser,
      stepIds: input.ids,
      role: 'editor',
      trx,
    })
    if (steps.length === 0) {
      throw new NotFoundError({
        modelClass: Step,
        message: 'Step not found. Refresh the page and try again.',
      })
    }

    if (!steps.every((step) => step.flowId === steps[0].flowId)) {
      throw new Error('All steps to be deleted must be from the same pipe!')
    }

    const flow = steps[0].flow
    flow.assertNotUpdatedSince(input.flow.updatedAt, context.currentUser.id)

    await deleteStepsInTransaction({ trx, flow, stepIds: input.ids })

    await flow.patchLastUpdated({
      flowId: flow.id,
      updatedBy: context.currentUser.id,
      trx,
    })

    return await flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

export default deleteStep
