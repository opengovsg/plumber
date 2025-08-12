import { z } from 'zod'

import FlowCollaborator from '@/models/flow-collaborators'

import type { QueryResolvers } from '../__generated__/types.generated'

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new Error('Please provide a valid pipe ID in your URL.')
  }

  // note: this query is available to owners, editors and viewers
  // they are able to view as long as they exist in the flow or flow_collaborators
  const flow = await context.currentUser
    .withAccessibleFlow()
    .withGraphFetched({
      pendingTransfer: {
        newOwner: true,
      },
    })
    .withGraphJoined({
      collaborators: true,
      steps: {
        connection: true,
      },
    })
    .orderBy('steps.position', 'asc')
    .findOne({ 'flows.id': params.id })
    .throwIfNotFound()

  // Order steps by position (since withGraphJoined doesn't work with our helper)
  if (flow.steps) {
    flow.steps.sort((a, b) => a.position - b.position)
  }

  // manually insert the owner as a collaborator
  // as the owner lives separately in the flows table
  const ownerCollaborator = new FlowCollaborator()
  ownerCollaborator.flowId = flow.id
  ownerCollaborator.userId = flow.userId
  ownerCollaborator.role = 'owner'
  ownerCollaborator.user = flow.user

  const collaborators = [...flow.collaborators, ownerCollaborator]

  return {
    ...flow,
    role: flow.role,
    collaborators,
  }
}

export default getFlow
