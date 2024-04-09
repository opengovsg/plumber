import { raw } from 'objection'

import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteStep: MutationResolvers['deleteStep'] = async (
  _parent,
  params,
  context,
) => {
  if (params.input.ids.length === 0) {
    throw new Error('Nothing to delete')
  }

  return await Step.transaction(async (trx) => {
    // Include SELECTs in transaction too just in case there's concurrent modification.
    const steps = await context.currentUser
      .$relatedQuery('steps', trx)
      .withGraphFetched('flow')
      .whereIn('steps.id', params.input.ids)
      .orderBy('steps.position', 'asc')
      .throwIfNotFound()

    if (!steps.every((step) => step.flowId === steps[0].flowId)) {
      throw new Error('All steps to be deleted must be from the same pipe!')
    }

    //
    // ** IMPORTANT NOTE **
    // We only support contiguous steps for now.
    //
    if (
      !steps.every(
        (step, index) =>
          index === 0 || step.position === steps[index - 1].position + 1,
      )
    ) {
      throw new Error('Must delete contiguous steps!')
    }

    const stepIds = steps.map((step) => step.id)
    await Step.relatedQuery('executionSteps', trx).for(stepIds).delete()
    await Step.query(trx).findByIds(stepIds).delete()

    await steps[0].flow
      .$relatedQuery('steps', trx)
      .where('position', '>', steps[steps.length - 1].position)
      .patch({ position: raw(`position - ${steps.length}`) })

    return await steps[0].flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

export default deleteStep
