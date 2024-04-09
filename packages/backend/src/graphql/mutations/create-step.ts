import Step from '@/models/step'

import type { MutationResolvers } from '../__generated__/types.generated'

const createStep: MutationResolvers['createStep'] = async (
  _parent,
  params,
  context,
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
