import testStep from '@/services/test-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const executeStep: MutationResolvers['executeStep'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId } = params.input

  // Just checking for permissions here
  const stepToTest = await context.currentUser
    .$relatedQuery('steps')
    .withGraphFetched('flow')
    .findById(stepId)
    .throwIfNotFound()

  const { executionStep, executionId } = await testStep({
    stepId: stepToTest.id,
  })

  // Update flow to use the new test execution
  await stepToTest.flow.$query().patch({
    testExecutionId: executionId,
  })

  // Update step status
  if (!executionStep.isFailed) {
    await stepToTest.$query().patch({
      status: 'completed',
      config: {}, // clear template step config when step is tested successfully
    })
  }

  return executionStep
}

export default executeStep
