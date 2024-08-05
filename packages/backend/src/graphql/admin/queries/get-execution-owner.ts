import Execution from '@/models/execution'

import type { AdminQueryResolvers } from '../../__generated__/types.generated'

const getExecutionOwner: AdminQueryResolvers['getExecutionOwner'] = async (
  _parent,
  params,
  _context,
) => {
  const { executionId } = params

  const execution = await Execution.query()
    .findById(executionId)
    .withGraphJoined({ flow: { user: true } })
    .throwIfNotFound()

  return execution.flow.user
}

export default getExecutionOwner
