import Step from '@/models/step'
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
    // Loads the whole flow's steps (not just the requested ids), since the
    // integrity logic below needs the full set to expand a marked if-then to
    // its block range and repair surviving blocks after the delete.
    const stepsBeforeDelete = await context.currentUser
      .withAccessibleSteps({ requiredRole: 'editor', trx })
      .withGraphFetched('flow')
      .whereIn(
        'steps.flow_id',
        Step.query(trx).select('flow_id').whereIn('id', input.ids),
      )
      .orderBy('steps.position', 'asc')
      .throwIfNotFound({
        message: 'Step not found. Refresh the page and try again.',
      })

    const steps = stepsBeforeDelete.filter((step) =>
      input.ids.includes(step.id),
    )

    // Confirm the request is single-pipe before deriving the flow, so
    // `steps[0].flow` is unambiguous (stepsBeforeDelete may span pipes if the
    // request mixed them).
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
