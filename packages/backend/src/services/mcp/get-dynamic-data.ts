import type {
  IDynamicData,
  IField,
  IJSONObject,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import apps from '@/apps'
import { UserFacingError } from '@/errors/user-facing-error'
import type Step from '@/models/step'
import type User from '@/models/user'
import { loadAccessibleStep } from '@/services/access'
import { runStepDynamicData } from '@/services/dynamic-data'

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

export async function getDynamicDataService({
  user,
  stepId,
  key,
  parameters,
}: GetDynamicDataInput): Promise<Array<{ name: string; value: string }>> {
  const step = await loadAccessibleStep({
    user,
    stepId,
    role: 'viewer',
    graph: {
      connection: true,
      flow: {
        user: true,
      },
    },
  })

  if (!step || !step.appKey) {
    throw new UserFacingError('Step not found')
  }

  const app = apps[step.appKey]
  const connection = step.connection

  if (app.auth && !connection) {
    throw new DynamicDataPrerequisiteError('Step has no verified connection')
  }

  const command = app.dynamicData?.find((data) => data.key === key) as
    | IDynamicData
    | undefined

  if (!command) {
    throw new UserFacingError(
      `Dynamic data key '${key}' not found for app '${step.appKey}'`,
    )
  }

  assertDependenciesSaved(step, key)

  // MCP callers are the pipe owner, so the lookup runs as the caller.
  const result = await runStepDynamicData({
    user,
    step,
    command,
    parameters,
    runAsOwner: false,
  })

  if (result.ok === false) {
    throw new UserFacingError(JSON.stringify(result.error))
  }

  return result.data
}
