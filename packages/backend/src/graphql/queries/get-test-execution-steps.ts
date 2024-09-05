import { getTestExecutionSteps as getTestExecutionStepsHelper } from '@/helpers/get-test-execution-steps'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTestExecutionSteps: QueryResolvers['getTestExecutionSteps'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, ignoreTestExecutionId } = params
  // For checking if flow belongs to the user
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphFetched({
      steps: true,
    })
    .findById(flowId)
    .throwIfNotFound()

  const testExecutionSteps = await getTestExecutionStepsHelper(
    flow.id,
    ignoreTestExecutionId,
  )

  // We do not return test execution steps if the step is not complete
  // to ensure we dont show variables from other step/events.
  // However, we will show errors regardless as the step may have never been
  // successfully tested before
  const completedStepsIds = flow.steps
    .filter((step) => step.status === 'completed')
    .map((step) => step.id)
  const completedStepIdsSet = new Set(completedStepsIds)
  const filteredTestExecutionSteps = testExecutionSteps.filter(
    (executionStep) => {
      if (executionStep.isFailed) {
        return true
      }
      return completedStepIdsSet.has(executionStep.stepId)
    },
  )
  return filteredTestExecutionSteps
}

export default getTestExecutionSteps
