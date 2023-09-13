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
  const step = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched('flow')
    .findOne({
      'steps.id': params.input.id,
    })
    .throwIfNotFound()

  await Step.transaction(async (trx) => {
    await step.$relatedQuery('executionSteps', trx).delete()
    await step.$query(trx).delete()

    const nextSteps = await step.flow
      .$relatedQuery('steps')
      .where('position', '>', step.position)

    const nextStepQueries = nextSteps.map(async (nextStep) => {
      await nextStep.$query().patch({
        position: nextStep.position - 1,
      })
    })

    await Promise.all(nextStepQueries)
  })

  step.flow = await step.flow
    .$query()
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')

  return step
}

export default deleteStep
