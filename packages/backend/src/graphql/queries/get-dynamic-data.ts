import { IDynamicData } from '@plumber/types'

import apps from '@/apps'
import { BadUserInputError } from '@/errors/graphql-errors'
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

  /**
   * if the user is a viewer:
   *   - use the flow owner's user so that they can see all the options.
   * if the user is an editor:
   *   - we need to check whether the current app is a readOnly (i.e., the editor does not have access to modify the connection).
   *   - if the editor can modify the connection, they would already have access to the options via the flow_connections table.
   * if the user is an owner:
   *   - use the current user so that they can see their own options.
   */
  const shouldUseOwnerUser =
    step.flow.role === 'viewer' ||
    APP_CONNECTION_FIELDS[step.appKey]?.editorReadOnly

  const $ = await globalVariable({
    connection,
    app,
    flow: step.flow,
    step,
    user: shouldUseOwnerUser ? step.flow.user : context.currentUser,
  })

  const command = app.dynamicData.find(
    (data) => data.key === dynamicDataKey,
  ) as IDynamicData | undefined

  if (!command) {
    throw new BadUserInputError(`Dynamic data ${dynamicDataKey} not found`)
  }

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
   * - show the Tiles that have been shared
   * - show the user's own Tiles (can be added and shared)
   *
   * Other connections:
   * - only show the connections that have been shared
   *
   */
  if (
    step.flow.role !== 'owner' &&
    APP_CONNECTION_FIELDS[step.appKey] &&
    APP_CONNECTION_FIELDS[step.appKey]?.dynamicDataKey === dynamicDataKey
  ) {
    switch (step.appKey) {
      case 'tiles': {
        /**
         * we still need to filter the data for viewers as they should only
         * see the Tiles that have been shared in this Pipe.
         * they should not be able to see their own or the owner's Tiles
         */
        if (step.flow.role === 'viewer') {
          const flowConnections = await context.currentUser
            .withAccessibleFlowConnections({ requiredRole: 'viewer' })
            .where({
              connection_type: 'table',
              'flow_connections.flow_id': step.flowId,
            })

          return fetchedData.data.filter((data) =>
            flowConnections.some(
              (flowConnection) => flowConnection.connectionId === data.value,
            ),
          )
        }

        // editors and owners should see both the shared and all their own Tiles
        return fetchedData.data
      }

      default: {
        const flowConnections = await context.currentUser
          .withAccessibleFlowConnections({ requiredRole: 'viewer' })
          .where({
            connection_id: step.connectionId,
            'flow_connections.flow_id': step.flowId,
          })

        const allowedValues = flowConnections
          .map((flowConnection) => {
            return flowConnection.metadata[
              APP_CONNECTION_FIELDS[step.appKey].parameterKey
            ]
          })
          .filter((value) => value !== undefined)
          .flat()

        return fetchedData.data.filter((data) =>
          allowedValues.includes(data.value),
        )
      }
    }
  }

  if (fetchedData.error) {
    throw new Error(JSON.stringify(fetchedData.error))
  }

  return fetchedData.data
}

export default getDynamicData
