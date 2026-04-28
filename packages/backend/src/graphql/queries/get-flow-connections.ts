import { IApp } from '@/../../types'
import { ForbiddenError } from '@/errors/graphql-errors'
import App from '@/models/app'
import FlowConnections from '@/models/flow-connections'

import { QueryResolvers } from '../__generated__/types.generated'

const getFlowConnections: QueryResolvers['getFlowConnections'] = async (
  _parent,
  params,
  context,
) => {
  const apps = await App.findAll()

  const flow = await context.currentUser
    .withAccessibleFlows({ requiredRole: 'editor' })
    .findById(params.flowId)

  if (!flow) {
    throw new ForbiddenError(
      'You do not have sufficient permissions for this pipe',
    )
  }

  const rawFlowConnections = await FlowConnections.query()
    .where({
      flow_id: params.flowId,
    })
    .withGraphFetched({
      connection: true,
      user: true,
      table: true,
    })

  const filteredFlowConnections = rawFlowConnections.filter(
    (flowConnection) => {
      if (flowConnection.connectionType === 'table') {
        return !!flowConnection.table
      }
      return !!flowConnection.connection
    },
  )

  const flowConnections = await Promise.all(
    filteredFlowConnections.map(async (flowConnection) => {
      let connectionName = flowConnection?.connection?.formattedData?.screenName
      if (flowConnection.connectionType === 'table' && flowConnection.table) {
        connectionName = flowConnection.table?.name
      }

      const appKey = flowConnection.connection?.key
      const app = apps.find(
        (app: IApp) =>
          app.key ===
          (flowConnection.connectionType === 'table' ? 'tiles' : appKey),
      )

      if (!app) {
        throw new Error(`App not found for key: ${appKey}`)
      }

      return {
        flowId: flowConnection.flowId,
        connectionId: flowConnection.connectionId,
        connectionType: flowConnection.connectionType,
        addedBy: flowConnection?.user?.email || '',
        appName: app.name,
        appIconUrl: app.iconUrl,
        connectionName: connectionName as string,
      }
    }),
  )

  return flowConnections
}

export default getFlowConnections
