import App from '@/models/app'
import FlowConnections from '@/models/flow-connections'

import type { MutationResolvers } from '../__generated__/types.generated'

// Sensitive graphql variables redacted in morgan.ts and datadog's Sensitive
// Data Scanner

const createConnection: MutationResolvers['createConnection'] = async (
  _parent,
  params,
  context,
) => {
  await App.findOneByKey(params.input.key)

  const newConnection = await context.currentUser
    .$relatedQuery('connections')
    .insert({
      key: params.input.key,
      formattedData: params.input.formattedData,
      verified: false,
    })

  /**
   * COLLABORATORS
   * If the flowId is provided and the flow has collaborators, we add this to the flow_connections table.
   * We add regardless of whether its a draft, so that it can be used by collaborators later.
   */
  if (params.input.flowId) {
    await FlowConnections.addFlowConnection({
      flowId: params.input.flowId,
      connectionId: newConnection.id,
      addedBy: context.currentUser.id,
      connectionType: 'connection',
    })
  }

  return newConnection
}

export default createConnection
