import { z } from 'zod'

import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const getOrCreateMockStep: MutationResolvers['getOrCreateMockStep'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId } = params.input

  if (!z.string().uuid().safeParse(flowId).success) {
    throw new Error('Invalid flow ID provided.')
  }

  await context.currentUser
    .$relatedQuery('flows')
    .findOne({ id: flowId })
    .throwIfNotFound()

  return await Step.transaction(async (trx) => {
    let mockStep = await Step.query(trx).findOne({
      flow_id: flowId,
      position: 0,
      type: 'mock',
    })

    if (!mockStep) {
      // insert new mock step
      mockStep = await Step.query(trx).insertAndFetch({
        position: 0,
        type: 'mock',
        status: 'incomplete',
        parameters: {},
        flowId,
      })
    }
    return mockStep
  })
}

export default getOrCreateMockStep
