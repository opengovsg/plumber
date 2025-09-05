import apps from '@/apps'
import {
  APP_CONNECTION_FIELDS,
  TILES_CONNECTION_ID,
} from '@/helpers/get-shared-connection-details'
import globalVariable from '@/helpers/global-variable'
import FlowConnections from '@/models/flow-connections'

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

  // we should filter out the dynamic data to only show the options
  // that have been shared with the user
  if (
    APP_CONNECTION_FIELDS[step.appKey] &&
    APP_CONNECTION_FIELDS[step.appKey].dynamicDataKey === dynamicDataKey &&
    step.role !== 'owner'
  ) {
    const flowConnections = await FlowConnections.withAccessible({
      userId: context.currentUser.id,
    }).where({
      // SPECIAL CASE: Tiles does not have a connection id
      // so we use a special connection id to store the dynamic data
      connection_id:
        app.key === 'tiles' ? TILES_CONNECTION_ID : step.connectionId,
      flow_id: step.flowId,
    })

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
