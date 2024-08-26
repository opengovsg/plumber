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

  /**
   * We need to unset the test execution id for execute flow because
   * the test run might not have tested all completed steps.
   * Need to account for the case where we release Single Step Testing then rollback
   * to test till step. In that case, we should unset test execution id to ensure we
   * we fetch the latest test execution steps (including test till step) after we
   * roll forward again
   */
  await untilStep.flow.$query().patch({
    testExecutionId: null,
  })

  untilStep.executionSteps = [executionStep] // attach missing execution step into current step

  if (!executionStep.isFailed) {
    await untilStep.$query().patch({
      status: 'completed',
    })
  }
  return executionStep
}

export default executeFlow
