import { actionQueuesByName } from '@/queues/action'

import type { AdminMutationResolvers } from '../../__generated__/types.generated'

const setGroupConcurrency: AdminMutationResolvers['setGroupConcurrency'] =
  async (_parent, params, _context) => {
    const {
      input: { groupId, appKey, concurrency },
    } = params

    const queueName = `{app-actions-${appKey}}`
    const queue = actionQueuesByName[queueName]

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`)
    }

    if (concurrency == undefined) {
      // unsets group concurrency
      await queue.deleteGroupConcurrency(groupId)
    } else if (typeof concurrency === 'number' && concurrency > 0) {
      // set group concurrency
      // actually sets this in the db, e.g.:
      // key: "bull:{app-actions-tiles}:groups:concurrency"
      // value: "{"<TILE_ID>-findSingleRow":"<CONCURRENCY>"}"
      await queue.setGroupConcurrency(groupId, concurrency)
    }

    const result = await queue.getGroupConcurrency(groupId)
    return result
  }

export default setGroupConcurrency
