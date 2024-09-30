import { BadUserInputError } from '@/errors/graphql-errors'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: MutationResolvers['updateStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  if (input.connection.id) {
    // if connectionId is specified, verify that the connection exists and belongs to the user
    const connection = await context.currentUser
      .$relatedQuery('connections')
      .findOne({ id: input.connection.id })
    if (!connection) {
      throw new BadUserInputError('Connection not found')
    }
  }

  const step = await Step.transaction(async (trx) => {
    const step = await context.currentUser.$relatedQuery('steps', trx).findOne({
      'steps.id': input.id,
      flow_id: input.flow.id,
    })
    if (!step) {
      throw new BadUserInputError('Step not found')
    }

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
