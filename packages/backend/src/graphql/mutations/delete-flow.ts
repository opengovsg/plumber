import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'

import type { MutationResolvers } from '../__generated__/types.generated'

const deleteFlow: MutationResolvers['deleteFlow'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  const executionIds = (
    await flow.$relatedQuery('executions').select('executions.id')
  ).map((execution: Execution) => execution.id)

  await ExecutionStep.query().delete().whereIn('execution_id', executionIds)

  await flow.$relatedQuery('executions').delete()
  await flow.$relatedQuery('steps').delete()
  await flow.$query().delete()

  return true
}

export default deleteFlow
