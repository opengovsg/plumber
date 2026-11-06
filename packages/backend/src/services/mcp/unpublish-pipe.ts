import { UserFacingError } from '@/errors/user-facing-error'
import type User from '@/models/user'
import { loadAccessibleFlow } from '@/services/access'
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
  const flow = await loadAccessibleFlow({
    user,
    flowId: pipeId,
    role: 'editor',
    graph: 'steps',
  })

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
    // assertNotUpdatedSince compares epoch milliseconds, not ISO strings.
    updatedAt: String(new Date(flow.updatedAt).getTime()),
  })

  return {
    pipeId: flow.id,
    active: false,
  }
}
