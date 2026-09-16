import { UserFacingError } from '@/errors/user-facing-error'
import type User from '@/models/user'
import { updateFlowStatusService } from '@/services/flow/update-flow-status'

export interface UnpublishPipeResult {
  pipeId: string
  active: false
  alreadyInactive?: true
}

export async function unpublishPipeService(
  user: User,
  pipeId: string,
): Promise<UnpublishPipeResult> {
  const flow = await user
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findOne({ 'flows.id': pipeId })
    .withGraphJoined('steps')
    .orderBy('steps.position', 'asc')

  if (!flow) {
    throw new UserFacingError('Pipe not found')
  }

  if (!flow.active) {
    return {
      pipeId: flow.id,
      active: false,
      alreadyInactive: true,
    }
  }

  await updateFlowStatusService({
    flow,
    active: false,
    userId: user.id,
  })

  return {
    pipeId: flow.id,
    active: false,
  }
}
