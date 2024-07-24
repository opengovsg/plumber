import Flow from '@/models/flow'

import type { AdminQueryResolvers } from '../../__generated__/types.generated'

const getFlowOwner: AdminQueryResolvers['getFlowOwner'] = async (
  _parent,
  params,
  _context,
) => {
  const { flowId } = params

  const flow = await Flow.query()
    .findById(flowId)
    .withGraphJoined({ user: true })
    .throwIfNotFound()

  return flow.user
}

export default getFlowOwner
