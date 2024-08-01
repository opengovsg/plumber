import { z } from 'zod'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new Error('Please provide a valid pipe ID in your URL.')
  }

  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphFetched({
      pendingTransfer: {
        newOwner: true,
      },
    })
    .withGraphJoined('[steps.[connection]]')
    .orderBy('steps.position', 'asc')
    .findOne({ 'flows.id': params.id })
    .throwIfNotFound()

  return flow
}

export default getFlow
