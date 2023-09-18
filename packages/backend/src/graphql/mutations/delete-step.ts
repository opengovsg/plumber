import { raw } from 'objection'

import Step from '@/models/step'
import Context from '@/types/express/context'

type Params = {
  input: {
    ids: string[]
  }
}

const deleteStep = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  if (params.input.ids.length === 0) {
    throw new Error('Nothing to delete')
  }

  const steps = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched('flow')
    .whereIn('steps.id', params.input.ids)
    .orderBy('steps.position', 'asc')
    .throwIfNotFound()

  if (!steps.every((step) => step.flowId === steps[0].flowId)) {
    throw new Error('All steps to be deleted must be from the same pipe!')
  }

  //
  // ** IMPORTANT NOTE **
  // We only support contiguous steps for now.
  //
  if (
    !steps.every(
      (step, index) =>
        index === 0 || step.position === steps[index - 1].position + 1,
    )
  ) {
    throw new Error('Must delete contiguous steps!')
  }

  const stepIds = steps.map((step) => step.id)
  await Step.relatedQuery('executionSteps').for(stepIds).delete()
  await Step.query().findByIds(stepIds).delete()

  await steps[0].flow
    .$relatedQuery('steps')
    .where('position', '>', steps[steps.length - 1].position)
    .patch({ position: raw(`position - ${steps.length}`) })

  return await steps[0].flow
    .$query()
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')
}

export default deleteStep
