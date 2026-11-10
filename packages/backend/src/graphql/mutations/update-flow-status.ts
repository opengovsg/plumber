import { BadUserInputError } from '@/errors/graphql-errors'
import { updateFlowStatusService } from '@/services/flow/update-flow-status'

import type { MutationResolvers } from '../__generated__/types.generated'

const updateFlowStatus: MutationResolvers['updateFlowStatus'] = async (
  _parent,
  params,
  context,
) => {
  const { input } = params
  if (!input) {
    throw new BadUserInputError('Missing input')
  }

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({
      'flows.id': input.id,
    })
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')
    .throwIfNotFound()

  return updateFlowStatusService({
    flow,
    active: input.active,
    userId: context.currentUser.id,
    updatedAt: input.updatedAt,
  })
}

export default updateFlowStatus
