import { IApp } from '@/../../types'
import { ForbiddenError } from '@/errors/graphql-errors'
import App from '@/models/app'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import TableMetadata from '@/models/table-metadata'

import { QueryResolvers } from '../__generated__/types.generated'

function findApp(appKey: string, apps: IApp[]): IApp {
  const app = apps.find((a: IApp) => a.key === appKey)
  if (!app) {
    throw new Error(`App not found for key: ${appKey}`)
  }
  return app
}

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
    .modifyGraph('connection', (builder) => {
      builder.where('draft', false)
    })

  /**
   * we check if there are any flow connections for the flow first
   * there is a possibility that an Editor could have been added to the flow,
   * added their connection, but was removed from the flow after.
   *
   * if there are none, then we fetch the connections from the steps
   */
  if (rawFlowConnections.length === 0) {
    const flowWithSteps = await Flow.query()
      .findById(params.flowId)
      .withGraphFetched({ steps: { connection: true } })

    const steps = flowWithSteps?.steps ?? []

    // Regular app connections: deduplicate by connectionId
    const seenConnectionIds = new Set<string>()
    const connectionResults = steps
      .filter((step) => {
        if (!step.connectionId || !step.connection) {
          return false
        }
        if (seenConnectionIds.has(step.connectionId)) {
          return false
        }
        seenConnectionIds.add(step.connectionId)
        return true
      })
      .map((step) => {
        const app = findApp(step.connection!.key, apps)
        return {
          flowId: params.flowId,
          connectionId: step.connectionId!,
          connectionType: 'connection',
          addedBy: context.currentUser.email,
          appName: app.name,
          appIconUrl: app.iconUrl,
          connectionName:
            (step.connection!.formattedData?.screenName as string) ?? '',
          isDeletable: false,
        }
      })

    // Tiles table connections: identified by appKey === 'tiles' + parameters.tableId
    const seenTableIds = new Set<string>()
    const tableSteps = steps.filter((step) => {
      const tableId = step.parameters?.tableId as string | undefined
      if (step.appKey !== 'tiles' || !tableId) {
        return false
      }
      if (seenTableIds.has(tableId)) {
        return false
      }
      seenTableIds.add(tableId)
      return true
    })

    const tilesApp = findApp('tiles', apps)
    const tableIds = tableSteps.map((step) => step.parameters.tableId as string)
    const tables = await TableMetadata.query().findByIds(tableIds)
    const tableMap = new Map(tables.map((t) => [t.id, t]))

    const tableResults = tableSteps.map((step) => {
      const tableId = step.parameters.tableId as string
      return {
        flowId: params.flowId,
        connectionId: tableId,
        connectionType: 'table',
        addedBy: context.currentUser.email,
        appName: tilesApp.name,
        appIconUrl: tilesApp.iconUrl,
        connectionName: tableMap.get(tableId)?.name ?? '',
        isDeletable: false,
      }
    })

    return [...connectionResults, ...tableResults]
  }

  const filteredFlowConnections = rawFlowConnections.filter(
    (flowConnection) => {
      if (flowConnection.connectionType === 'table') {
        return !!flowConnection.table
      }
      return !!flowConnection.connection
    },
  )

  return filteredFlowConnections.map((flowConnection) => {
    const isTable = flowConnection.connectionType === 'table'
    const appKey = isTable ? 'tiles' : flowConnection.connection?.key
    const connectionName = isTable
      ? (flowConnection.table?.name ?? '')
      : ((flowConnection.connection?.formattedData?.screenName as string) ?? '')
    const app = findApp(appKey!, apps)

    return {
      flowId: flowConnection.flowId,
      connectionId: flowConnection.connectionId,
      connectionType: flowConnection.connectionType,
      addedBy: flowConnection?.user?.email || '',
      appName: app.name,
      appIconUrl: app.iconUrl,
      connectionName,
      isDeletable: true,
    }
  })
}

export default getFlowConnections
