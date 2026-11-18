import { NotFoundError } from 'objection'

import Flow from '@/models/flow'
import { loadAccessibleFlow } from '@/services/access'
import { updateFlowStatusService } from '@/services/flow/update-flow-status'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlowStatus: MutationResolvers['updateFlowStatus'] = async (
  _parent,
  params,
  context,
) => {
  const flow = await loadAccessibleFlow({
    user: context.currentUser,
    flowId: params.input.id,
    role: 'editor',
    graph: 'steps',
  })

  if (!flow) {
    throw new NotFoundError({ modelClass: Flow })
  }

  return updateFlowStatusService({
    flow,
    active: params.input.active,
    userId: context.currentUser.id,
    updatedAt: params.input.updatedAt,
  })
}

export default updateFlowStatus
