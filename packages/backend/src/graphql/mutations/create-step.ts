import { raw } from 'objection'

import { BadUserInputError } from '@/errors/graphql-errors'
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

    if (input.connection?.id) {
      // if connectionId is specified, verify that the connection exists and belongs to the user
      const connection = await context.currentUser
        .$relatedQuery('connections')
        .findOne({ id: input.connection.id })
      if (!connection) {
        throw new BadUserInputError('Connection not found')
      }
    }

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
      connectionId: input.connection?.id,
    })

    await flow.$query(trx).patch({ updatedAt: new Date().toISOString() })

    return step
  })
}

export default createStep
