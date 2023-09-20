import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const deleteStep = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  return await Step.transaction(async (trx) => {
    // Include SELECTs in transaction too just in case there's concurrent modification.
    const step = await context.currentUser
      .$relatedQuery('steps', trx)
      .withGraphFetched('flow')
      .findOne({
        'steps.id': params.input.id,
      })
      .throwIfNotFound()

    await step.$relatedQuery('executionSteps', trx).delete()
    await step.$query(trx).delete()

    const nextSteps = await step.flow
      .$relatedQuery('steps', trx)
      .where('position', '>', step.position)

    const nextStepQueries = nextSteps.map(async (nextStep) => {
      await nextStep.$query(trx).patch({
        position: nextStep.position - 1,
      })
    })

    await Promise.all(nextStepQueries)

    step.flow = await step.flow
      .$query()
      .withGraphJoined('steps')
      .orderBy('steps.position', 'asc')

    return step
  })
}

export default deleteStep
