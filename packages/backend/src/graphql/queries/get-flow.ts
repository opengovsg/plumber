import { NotFoundError as ObjectionNotFoundError } from 'objection'
import { z } from 'zod'

import { NotFoundError } from '@/errors/graphql-errors/not-found'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new NotFoundError('Please provide a valid pipe ID in your URL.')
  }

  try {
    const flow = await context.currentUser
      .withAccessibleFlows({ requiredRole: 'viewer' })
      .withGraphFetched({
        steps: {
          connection: true,
        },
        pendingTransfer: {
          newOwner: true,
        },
      })
      .findOne({ 'flows.id': params.id })
      .throwIfNotFound()

    // Order steps by position (since withGraphJoined doesn't work with our helper)
    if (flow.steps) {
      flow.steps.sort((a, b) => a.position - b.position)
    }

    return flow
  } catch (e) {
    // IMPORTANT: formatError masks non-GraphQL errors. The editor needs NOT_FOUND to show its not-found page.
    if (e instanceof ObjectionNotFoundError) {
      throw new NotFoundError('Pipe not found.')
    }
    throw e
  }
}

export default getFlow
