import { BadUserInputError } from '@/errors/graphql-errors'
import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateStep: MutationResolvers['updateStep'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params

  const step = await Step.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;')

    const step = await context.currentUser
      .$relatedQuery('steps', trx)
      .findOne({
        'steps.id': input.id,
        flow_id: input.flow.id,
      })
      .withGraphFetched('flow')

    if (!step) {
      throw new BadUserInputError('Step not found')
    }

    if (input.connection.id) {
      // if connectionId is specified, verify that the connection exists and belongs to the user
      const connection = await context.currentUser
        .$relatedQuery('connections')
        .findOne({ id: input.connection.id })
      // we check that the connection exists and is the same app
      if (!connection || connection.key !== input.appKey) {
        throw new BadUserInputError('Connection not found')
      }
    }

    const shouldInvalidate =
      step.key !== input.key ||
      step.appKey !== input.appKey ||
      input.status === 'incomplete'

    const stepName = input?.config?.stepName ?? step?.config?.stepName
    const existingConfig = step?.config ?? {}

    const updatedStep = await Step.query(trx)
      .patchAndFetchById(input.id, {
        key: input.key,
        appKey: input.appKey,
        connectionId: input.connection.id,
        parameters: input.parameters,
        status: shouldInvalidate ? 'incomplete' : step.status,
        config: {
          ...existingConfig,
          // NOTE: check for undefined to allow empty string, which defaults to the action/trigger name
          ...(stepName !== undefined ? { stepName } : {}),
        },
      })
      .withGraphFetched('connection')

    // update the flow's last updated
    await step.flow.$query(trx).patch({
      updatedAt: new Date().toISOString(),
    })

    return updatedStep
  })

  return step
}

export default updateStep
