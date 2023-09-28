import { type IJSONObject } from '@plumber/types'

import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    key: string
    appKey: string
    flow: {
      id: string
    }
    connection: {
      id: string
    }
    previousStep: {
      id: string
    }
    parameters: IJSONObject
  }
}

const createStep = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { input } = params

  return await Step.transaction(async (trx) => {
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

    const step = await flow.$relatedQuery('steps', trx).insertAndFetch({
      key: input.key,
      appKey: input.appKey,
      type: 'action',
      position: previousStep.position + 1,
      parameters: input.parameters,
    })

    const nextSteps = await flow
      .$relatedQuery('steps', trx)
      .where('position', '>=', step.position)
      .whereNot('id', step.id)

    const nextStepQueries = nextSteps.map(async (nextStep, index) => {
      await nextStep.$query(trx).patchAndFetch({
        position: step.position + index + 1,
      })
    })

    await Promise.all(nextStepQueries)

    return step
  })
}

export default createStep
