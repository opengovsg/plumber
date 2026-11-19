import type {
  DynamicDataOutput,
  IDynamicData,
  IJSONObject,
} from '@plumber/types'

import apps from '@/apps'
import { APP_CONNECTION_FIELDS } from '@/helpers/get-shared-connection-details'
import globalVariable from '@/helpers/global-variable'
import type Step from '@/models/step'
import type User from '@/models/user'

export type StepDynamicDataResult =
  | { ok: true; data: DynamicDataOutput['data'] }
  | { ok: false; error: IJSONObject }

export function shouldRunDynamicDataAsOwner(step: Step): boolean {
  return (
    step.flow.role === 'viewer' ||
    APP_CONNECTION_FIELDS[step.appKey]?.editorReadOnly === true
  )
}

export async function runStepDynamicData({
  user,
  step,
  command,
  parameters,
  runAsOwner,
}: {
  user: User
  step: Step
  command: IDynamicData
  parameters?: Record<string, unknown> | null
  runAsOwner: boolean
}): Promise<StepDynamicDataResult> {
  const app = apps[step.appKey ?? '']
  const $ = await globalVariable({
    connection: step.connection ?? undefined,
    app,
    flow: step.flow,
    step,
    user: runAsOwner ? step.flow.user : user,
  })

  if (parameters) {
    for (const [parameterKey, parameterValue] of Object.entries(parameters)) {
      $.step.parameters[parameterKey] = parameterValue as IJSONObject[string]
    }
  }

  const fetchedData = await command.run($)
  const sharedOptions = await filterSharedOptions(
    user,
    step,
    command.key,
    fetchedData.data,
  )

  // The collaborator branch returns before the error check. A reported
  // command error must not replace that list, including an empty one.
  if (sharedOptions !== undefined) {
    return { ok: true, data: sharedOptions }
  }

  if (fetchedData.error) {
    return { ok: false, error: fetchedData.error }
  }

  return { ok: true, data: fetchedData.data }
}

async function filterSharedOptions(
  user: User,
  step: Step,
  dynamicDataKey: string,
  data: DynamicDataOutput['data'],
): Promise<DynamicDataOutput['data'] | undefined> {
  const fields = step.appKey ? APP_CONNECTION_FIELDS[step.appKey] : undefined
  if (
    step.flow.role === 'owner' ||
    !fields ||
    fields.dynamicDataKey !== dynamicDataKey
  ) {
    return undefined
  }

  if (step.appKey === 'tiles') {
    if (step.flow.role === 'viewer') {
      const flowConnections = await user
        .withAccessibleFlowConnections({ requiredRole: 'viewer' })
        .where({
          connection_type: 'table',
          'flow_connections.flow_id': step.flowId,
        })

      return data.filter((item) =>
        flowConnections.some(
          (flowConnection) => flowConnection.connectionId === item.value,
        ),
      )
    }

    return data
  }

  const flowConnections = await user
    .withAccessibleFlowConnections({ requiredRole: 'viewer' })
    .where({
      connection_id: step.connectionId,
      'flow_connections.flow_id': step.flowId,
    })

  const allowedValues = flowConnections
    .map((flowConnection) => flowConnection.metadata[fields.parameterKey])
    .filter((value) => value !== undefined)
    .flat()

  return data.filter((item) => allowedValues.includes(item.value))
}
