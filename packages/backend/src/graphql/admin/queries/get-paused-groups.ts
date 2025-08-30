import { GroupStatus } from '@taskforcesh/bullmq-pro'

import { actionQueuesByName } from '@/queues/action'

import type { AdminQueryResolvers } from '../../__generated__/types.generated'

const getPausedGroups: AdminQueryResolvers['getPausedGroups'] = async (
  _parent,
  params,
  _context,
) => {
  const { appKey } = params
  const queueName = `{app-actions-${appKey}}`
  const queue = actionQueuesByName[queueName]

  if (!queue) {
    throw new Error(`Queue ${queueName} not found`)
  }

  const pausedGroups = await queue.getGroupsByStatus(GroupStatus.Paused)
  return pausedGroups.map((group) => group.id)
}

export default getPausedGroups
