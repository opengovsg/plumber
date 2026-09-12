import { getTestExecutionSteps as getTestExecutionStepsHelper } from '@/helpers/get-test-execution-steps'

import type { QueryResolvers } from '../__generated__/types.generated'

const getTestExecutionSteps: QueryResolvers['getTestExecutionSteps'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId } = params
  // For checking if user is a collaborator
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .findById(flowId)
    .throwIfNotFound()

  /**
   * Note: We only return test execution steps from steps with the status: 'completed'.
   * For now, only when pipe is transferred, excel steps will become incomplete.
   */
  return getTestExecutionStepsHelper(flow.id, {
    testExecutionId: flow.testExecutionId ?? null,
  })
}

export default getTestExecutionSteps
