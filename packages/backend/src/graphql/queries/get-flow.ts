import { z } from 'zod'

import type { QueryResolvers } from '../__generated__/types.generated'

type GraphFetchedOptions = {
  steps: {
    connection: boolean
  }
  pendingTransfer?: {
    newOwner: boolean
  }
  collaborators?: boolean
}

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!z.string().uuid().safeParse(params.id).success) {
    throw new Error('Please provide a valid pipe ID in your URL.')
  }

  // note: this query is available to owners, editors and viewers
  // they are able to view as long as they exist in the flow or flow_collaborators
  const graphFetchedOptions: GraphFetchedOptions = {
    steps: {
      connection: true,
    },
  }

  // Only fetch pendingTransfer if explicitly requested
  if (params.includePendingTransfer) {
    graphFetchedOptions.pendingTransfer = {
      newOwner: true,
    }
  }

  if (params.includeCollaborators) {
    graphFetchedOptions.collaborators = true
  }

  const flow = await context.currentUser
    .withAccessibleFlows()
    .withGraphFetched(graphFetchedOptions)
    .findOne({ 'flows.id': params.id })
    .throwIfNotFound()

  // Order steps by position (since withGraphJoined doesn't work with our helper)
  if (flow.steps) {
    flow.steps.sort((a, b) => a.position - b.position)
  }

  return {
    ...flow,
    role: flow.role,
  }
}

export default getFlow
