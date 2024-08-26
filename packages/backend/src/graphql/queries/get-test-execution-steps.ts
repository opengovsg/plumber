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
    .findById(flowId)
    .throwIfNotFound()

  return getTestExecutionStepsHelper(flow.id, ignoreTestExecutionId)
}

export default getTestExecutionSteps
