import type {
  IFieldMultiRowMultiCol,
  IJSONObject,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import apps from '@/apps'
import { UserFacingError } from '@/errors/user-facing-error'
import type User from '@/models/user'

import { getDynamicDataService } from './get-dynamic-data'

export interface ListColumnsInput {
  user: User
  stepId: string
}

export interface ListColumnsResult {
  columns: Array<{ id: string; name: string }>
  alreadyConfigured: string[]
  truncated: boolean
}

const MAX_COLUMNS = 50

function findMultiRowMultiColField(
  rawTriggerOrAction: IRawAction | IRawTrigger | undefined,
): IFieldMultiRowMultiCol | undefined {
  return rawTriggerOrAction?.arguments?.find(
    (field): field is IFieldMultiRowMultiCol =>
      field.type === 'multirow-multicol',
  )
}

export async function listColumnsService({
  user,
  stepId,
}: ListColumnsInput): Promise<ListColumnsResult> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'viewer' })
    .findById(stepId)

  if (!step || !step.appKey) {
    throw new UserFacingError('Step not found')
  }

  const app = apps[step.appKey]
  const rawTriggerOrAction = (
    step.type === 'trigger'
      ? app?.triggers?.find((t) => t.key === step.key)
      : app?.actions?.find((a) => a.key === step.key)
  ) as IRawAction | IRawTrigger | undefined

  const field = findMultiRowMultiColField(rawTriggerOrAction)
  if (!field) {
    throw new UserFacingError(
      'Step has no multirow-multicol field to list columns for',
    )
  }

  const columnField = field.subFields[0]
  if (!columnField || columnField.type !== 'dropdown') {
    throw new UserFacingError(
      "Field's first subField has no dynamic-data source to list columns from",
    )
  }

  const key = columnField.source?.arguments.find((a) => a.name === 'key')?.value
  if (!key) {
    throw new UserFacingError(
      "Field's first subField has no dynamic-data source to list columns from",
    )
  }

  const savedValue = (step.parameters as IJSONObject | undefined)?.[field.key]
  if (savedValue !== undefined && !Array.isArray(savedValue)) {
    throw new UserFacingError(
      `Saved value for '${field.key}' is not an array. Call update_step_parameters to replace '${field.key}' with an array of objects (or [] if none are configured yet), then call list_columns again.`,
    )
  }

  const data = await getDynamicDataService({ user, stepId, key })

  const savedRows = (savedValue ?? []) as Array<Record<string, unknown>>
  const alreadyConfigured = savedRows
    .map((row) => row[columnField.key])
    .filter((v): v is string => typeof v === 'string')

  const notYetConfigured = data.filter(
    (column) => !alreadyConfigured.includes(column.value),
  )

  return {
    columns: notYetConfigured
      .slice(0, MAX_COLUMNS)
      .map((column) => ({ id: column.value, name: column.name })),
    alreadyConfigured,
    truncated: notYetConfigured.length > MAX_COLUMNS,
  }
}
