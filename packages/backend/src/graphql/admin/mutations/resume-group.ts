import { actionQueuesByName } from '@/queues/action'

import type { AdminMutationResolvers } from '../../__generated__/types.generated'

const resumeGroup: AdminMutationResolvers['resumeGroup'] = async (
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

  return queue.resumeGroup(groupId)
}

export default resumeGroup
