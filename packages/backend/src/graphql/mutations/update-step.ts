import { IJSONObject } from '@plumber/types'

import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    key: string
    appKey: string
    parameters: IJSONObject
    flow: {
      id: string
    }
    connection: {
      id: string
    }
  }
}

const updateStep = async (
  _parent: unknown,
  params: Params,
  context: Context,
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
