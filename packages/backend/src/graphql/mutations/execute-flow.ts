import testRun from '@/services/test-run'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeFlow: NonNullable<MutationResolvers['executeFlow']> = async (
  _parent,
  params,
  context,
) => {
  const { stepId } = params.input

  const untilStep = await context.currentUser
    .$relatedQuery('steps')
    .findById(stepId)
    .throwIfNotFound()

  const { executionStep } = await testRun({ stepId })

  untilStep.executionSteps = [executionStep] // attach missing execution step into current step

  if (executionStep.isFailed) {
    throw new Error(JSON.stringify(executionStep.errorDetails))
  }

  if (executionStep.dataOut) {
    await untilStep.$query().patch({
      status: 'completed',
    })
  }

  return { data: executionStep.dataOut, step: untilStep }
}

export default executeFlow
