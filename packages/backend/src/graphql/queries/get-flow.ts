import { NotFoundError } from 'objection'
import { z } from 'zod'

import Flow from '@/models/flow'
import { loadAccessibleFlow } from '@/services/access'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new Error('Please provide a valid pipe ID in your URL.')
  }

  const flow = await loadAccessibleFlow({
    user: context.currentUser,
    flowId: params.id,
    role: 'viewer',
    graph: {
      steps: {
        connection: true,
      },
      pendingTransfer: {
        newOwner: true,
      },
    },
  })

  if (!flow) {
    throw new NotFoundError({ modelClass: Flow })
  }

  return flow
}

export default getFlow
