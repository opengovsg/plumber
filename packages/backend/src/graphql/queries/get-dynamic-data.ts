import apps from '@/apps'
import { APP_CONNECTION_FIELDS } from '@/helpers/get-shared-connection-details'
import globalVariable from '@/helpers/global-variable'

import type { QueryResolvers } from '../__generated__/types.generated'

const getDynamicData: QueryResolvers['getDynamicData'] = async (
  _parent,
  params,
  context,
) => {
  const { stepId, key: dynamicDataKey, parameters } = params

  const step = await context.currentUser
    .withAccessibleSteps({ requiredRole: 'viewer' })
    .withGraphFetched({
      connection: true,
      flow: {
        user: true,
      },
    })
    .findById(stepId)

  if (!step || !step.appKey) {
    return null
  }

  const app = apps[step.appKey]
  const connection = step.connection

  // if app requires connection, only proceed if connection has been set up
  if (app.auth && !connection) {
    return null
  }

  const $ = await globalVariable({
    connection,
    app,
    flow: step.flow,
    step,
    user: step.flow.user,
  })

  const command = app.dynamicData.find((data) => data.key === dynamicDataKey)

  for (const parameterKey in parameters) {
    const parameterValue = parameters[parameterKey]
    $.step.parameters[parameterKey] = parameterValue
  }

  const fetchedData = await command.run($)

  /**
   * COLLABORATORS
   * filter out the dynamic data to only show the options that have been shared with the user
   *
   * Tiles:
   * - only show the Tiles that have been shared
   *
   * Other connections:
   * - only show the connections that have been shared
   *
   * TODO (kevinkim-ogp): phase 2
   * - collaborator should be able to add their own Tiles
   */
  if (
    step.role !== 'owner' &&
    APP_CONNECTION_FIELDS[step.appKey] &&
    APP_CONNECTION_FIELDS[step.appKey]?.dynamicDataKey === dynamicDataKey
  ) {
    const whereClause =
      step.appKey === 'tiles'
        ? {
            connection_type: 'table',
            flow_id: step.flowId,
          }
        : {
            connection_id: step.connectionId,
            flow_id: step.flowId,
          }
    const flowConnections = await context.currentUser
      .withAccessible({
        type: 'flow-connections',
        requiredRole: 'viewer',
      })
      .where(whereClause)

    // TILES SPECIAL CASE:
    // tile ids are stored directly in the connection_id column
    if (step.appKey === 'tiles') {
      return fetchedData.data.filter((data) =>
        flowConnections.some(
          (flowConnection) => flowConnection.connectionId === data.value,
        ),
      )
    }

    const allowedValues = flowConnections
      .map((flowConnection) => {
        return flowConnection.metadata[
          APP_CONNECTION_FIELDS[step.appKey].parameterKey
        ]
      })
      .flat()

    return fetchedData.data.filter((data) => allowedValues.includes(data.value))
  }

  if (fetchedData.error) {
    throw new Error(JSON.stringify(fetchedData.error))
  }

  return fetchedData.data
}

export default getDynamicData
