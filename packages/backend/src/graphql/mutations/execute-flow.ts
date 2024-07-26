import testRun from '@/services/test-run'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeFlow: MutationResolvers['executeFlow'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId } = params.input

  const untilStep = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  if (untilStep.flow.active) {
    throw new Error('Cannot test pipe that is currently published')
  }

  const { executionStep } = await testRun({ stepId })

  untilStep.executionSteps = [executionStep] // attach missing execution step into current step

  if (!executionStep.isFailed) {
    await untilStep.$query().patch({
      status: 'completed',
    })
  }
  return executionStep
}

export default executeFlow
