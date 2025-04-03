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
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')
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

    const flow = steps[0].flow

    //
    // ** IMPORTANT NOTE **
    // We only support deleting single trigger steps or contiguous action steps.
    //
    if (steps.length === 1 && steps[0].type === 'trigger') {
      // we delete and add a new trigger upon deletion to preserve past execution steps' context
      await steps[0].$query().delete()
      await flow.$relatedQuery('steps', trx).insert({
        key: null,
        appKey: null,
        type: 'trigger',
        position: 1,
        parameters: {},
        connectionId: null,
      })
    } else {
      if (
        !steps.every(
          (step, index) =>
            (index === 0 || step.position === steps[index - 1].position + 1) &&
            step.type === 'action',
        )
      ) {
        throw new Error('Must delete contiguous action steps!')
      }

      const stepIds = steps.map((step) => step.id)

      /**
       * NOTE: do not delete execution steps
       * The deletion causes RDS CPU Utilisation to spike for high volume pipes.
       */
      // await Step.relatedQuery('executionSteps', trx).for(stepIds).delete()
      await Step.query(trx).findByIds(stepIds).delete()

      await flow
        .$relatedQuery('steps', trx)
        .where('position', '>', steps[steps.length - 1].position)
        .patch({ position: raw(`position - ${steps.length}`) })
    }

    return await flow
      .$query(trx)
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')
  })
}

export default deleteStep
