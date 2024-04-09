import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: MutationResolvers['updateStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser
      .$relatedQuery('steps', trx)
      .findOne({
        'steps.id': input.id,
        flow_id: input.flow.id,
      })
      .throwIfNotFound()

    const shouldInvalidate =
      step.key !== input.key || step.appKey !== input.appKey

    return await Step.query(trx)
      .patchAndFetchById(input.id, {
        key: input.key,
        appKey: input.appKey,
        connectionId: input.connection.id,
        parameters: input.parameters,
        status: shouldInvalidate ? 'incomplete' : step.status,
      })
      .withGraphFetched('connection')
  })

  return step
}

export default updateStep
