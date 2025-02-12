import { raw } from 'objection'

import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const createStep: MutationResolvers['createStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  return await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    // Put SELECTs in transaction just in case there's concurrent modification.
    const flow = await context.currentUser
      .$relatedQuery('flows', trx)
      .findOne({
        id: input.flow.id,
      })
      .throwIfNotFound()

    const previousStep = await flow
      .$relatedQuery('steps', trx)
      .findOne({
        id: input.previousStep.id,
      })
      .throwIfNotFound()

    await flow
      .$relatedQuery('steps', trx)
      .patch({
        position: raw(`position + 1`),
      })
      .where('position', '>=', previousStep.position + 1)

    const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
      key: input.key,
      appKey: input.appKey,
      type: 'action',
      position: previousStep.position + 1,
      parameters: input.parameters,
    })

    return step
  })
}

export default createStep
