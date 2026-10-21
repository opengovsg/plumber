import { updateFlowStatusService } from '@/services/flow/update-flow-status'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlowStatus: MutationResolvers['updateFlowStatus'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      'flows.id': params.input.id,
    })
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')
    .throwIfNotFound()

  return updateFlowStatusService({
    flow,
    active: params.input.active,
    userId: context.currentUser.id,
    updatedAt: params.input.updatedAt,
  })
}

export default updateFlowStatus
