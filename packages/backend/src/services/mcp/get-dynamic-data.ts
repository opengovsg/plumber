import type { IDynamicData, IJSONObject } from '@plumber/types'

import apps from '@/apps'
import { APP_CONNECTION_FIELDS } from '@/helpers/get-shared-connection-details'
import globalVariable from '@/helpers/global-variable'
import type User from '@/models/user'

export interface GetDynamicDataInput {
  user: User
  stepId: string
  key: string
  parameters?: IJSONObject
}

// TODO: Consider extracting shared logic with the getDynamicData GraphQL resolver
// (src/graphql/queries/get-dynamic-data.ts) into a shared helper when Phase 2
// editor role support is added.
export async function getDynamicDataService({
  user,
  stepId,
  key,
  parameters,
}: GetDynamicDataInput): Promise<Array<{ name: string; value: string }>> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'viewer' })
    .withGraphFetched({
      connection: true,
      flow: {
        user: true,
      },
    })
    .findById(stepId)

  if (!step || !step.appKey) {
    throw new Error('Step not found')
  }

  const app = apps[step.appKey]
  const connection = step.connection

  if (app.auth && !connection) {
    throw new Error('Step has no verified connection')
  }

  // Phase 1: caller is always the pipe owner; role substitution is never needed.
  // Phase 2 (editor role support): enable the commented logic so that viewers and
  // editors of editorReadOnly apps use the flow owner's credentials for run().
  // TODO: enable when Phase 2 editor support is added.
  const shouldUseOwnerUser = false
  // const shouldUseOwnerUser =
  //   step.flow.role === 'viewer' ||
  //   APP_CONNECTION_FIELDS[step.appKey]?.editorReadOnly

  const command = app.dynamicData?.find((data) => data.key === key) as
    | IDynamicData
    | undefined

  if (!command) {
    throw new Error(
      `Dynamic data key '${key}' not found for app '${step.appKey}'`,
    )
  }

  const $ = await globalVariable({
    connection: connection ?? undefined,
    app,
    flow: step.flow,
    step,
    user: shouldUseOwnerUser ? step.flow.user : user,
  })

  if (parameters) {
    for (const [paramKey, paramValue] of Object.entries(parameters)) {
      $.step.parameters[paramKey] = paramValue
    }
  }

  const fetchedData = await command.run($)

  // NOTE: APP_CONNECTION_FIELDS filtering is applied here for Phase 2 readiness.
  // In Phase 1 (pipe owner only), step.flow.role is always 'owner' so this block
  // is always skipped. When Phase 2 editor support is added, this becomes meaningful.
  if (
    step.flow.role !== 'owner' &&
    APP_CONNECTION_FIELDS[step.appKey] &&
    APP_CONNECTION_FIELDS[step.appKey]?.dynamicDataKey === key
  ) {
    switch (step.appKey) {
      case 'tiles': {
        if (step.flow.role === 'viewer') {
          const flowConnections = await user
            .withAccessibleFlowConnections({ requiredRole: 'viewer' })
            .where({
              connection_type: 'table',
              'flow_connections.flow_id': step.flowId,
            })
          return fetchedData.data.filter((data) =>
            flowConnections.some((fc) => fc.connectionId === data.value),
          )
        }
        return fetchedData.data
      }

      default: {
        const flowConnections = await user
          .withAccessibleFlowConnections({ requiredRole: 'viewer' })
          .where({
            connection_id: step.connectionId,
            'flow_connections.flow_id': step.flowId,
          })
        const allowedValues = flowConnections
          .map(
            (fc) =>
              fc.metadata[APP_CONNECTION_FIELDS[step.appKey].parameterKey],
          )
          .filter((v) => v !== undefined)
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
