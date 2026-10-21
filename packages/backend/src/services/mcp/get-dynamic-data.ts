import type {
  IDynamicData,
  IField,
  IJSONObject,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import apps from '@/apps'
import { UserFacingError } from '@/errors/user-facing-error'
import { APP_CONNECTION_FIELDS } from '@/helpers/get-shared-connection-details'
import globalVariable from '@/helpers/global-variable'
import type Step from '@/models/step'
import type User from '@/models/user'

export interface GetDynamicDataInput {
  user: User
  stepId: string
  key: string
  parameters?: IJSONObject
}

// Missing connection or dependent parameter — route tags this with a `code`
// so the frontend forwards the reason to the LLM instead of a generic error.
export class DynamicDataPrerequisiteError extends UserFacingError {
  constructor(message: string) {
    super(message)
    this.name = 'DynamicDataPrerequisiteError'
  }
}

// Recurse into subFields — a dynamic-data key can be declared on a nested
// field (e.g. M365 Excel's listTableColumns under columnValues[].subFields).
function flattenFields(fields: IField[]): IField[] {
  return fields.flatMap((field) =>
    'subFields' in field && field.subFields
      ? [field, ...flattenFields(field.subFields as IField[])]
      : [field],
  )
}

// A key's dependency params live on the field schema referencing it
// (source.arguments' `parameters.X` entries), not on the IDynamicData command.
function getDependencyParamNames(
  rawTriggerOrAction: IRawAction | IRawTrigger | undefined,
  key: string,
): string[] {
  const fields = flattenFields(rawTriggerOrAction?.arguments ?? [])
  for (const field of fields) {
    if (field.type !== 'dropdown' || !field.source?.arguments) {
      continue
    }
    const keyArg = field.source.arguments.find((a) => a.name === 'key')
    if (keyArg?.value !== key) {
      continue
    }
    return field.source.arguments
      .filter((a) => a.name.startsWith('parameters.'))
      .map((a) => a.name.slice('parameters.'.length))
  }
  return []
}

// Throws naming whichever dependency parameter(s) aren't saved yet, instead
// of resolvers silently returning an empty (and ambiguous) list.
function assertDependenciesSaved(step: Step, key: string): void {
  const app = apps[step.appKey ?? '']
  const rawTriggerOrAction = (
    step.type === 'trigger'
      ? app?.triggers?.find((t) => t.key === step.key)
      : app?.actions?.find((a) => a.key === step.key)
  ) as IRawAction | IRawTrigger | undefined

  const dependencyParamNames = getDependencyParamNames(rawTriggerOrAction, key)
  const missing = dependencyParamNames.filter((name) => {
    const value = (step.parameters as IJSONObject | undefined)?.[name]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw new DynamicDataPrerequisiteError(
      `Missing required value for ${missing
        .map((m) => `'${m}'`)
        .join(
          ', ',
        )} — save it via update_step_parameters before requesting this field's options.`,
    )
  }
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
    throw new UserFacingError('Step not found')
  }

  const app = apps[step.appKey]
  const connection = step.connection

  if (app.auth && !connection) {
    throw new DynamicDataPrerequisiteError('Step has no verified connection')
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
    throw new UserFacingError(
      `Dynamic data key '${key}' not found for app '${step.appKey}'`,
    )
  }

  assertDependenciesSaved(step, key)

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
    throw new UserFacingError(JSON.stringify(fetchedData.error))
  }

  return fetchedData.data
}
