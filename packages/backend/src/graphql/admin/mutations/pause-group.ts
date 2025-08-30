import { actionQueuesByName } from '@/queues/action'

import type { AdminMutationResolvers } from '../../__generated__/types.generated'

const pauseGroup: AdminMutationResolvers['pauseGroup'] = async (
  _parent,
  params,
  _context,
) => {
  const {
    input: { groupId, appKey },
  } = params

  const queueName = `{app-actions-${appKey}}`
  const queue = actionQueuesByName[queueName]

  if (!queue) {
    throw new Error(`Queue ${queueName} not found`)
  }

  return queue.pauseGroup(groupId)
}

export default pauseGroup
