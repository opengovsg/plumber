import type {
  IField,
  IJSONObject,
  IJSONValue,
  IRawAction,
  IRawTrigger,
} from '@plumber/types'

import { isEqual } from 'lodash'

import apps from '@/apps'
import { SECRET_KEY_REGEXP } from '@/helpers/redaction/sensitive-keys'
import type User from '@/models/user'
import { redactCredentials, REDACTED_VALUE } from '@/services/mcp/get-flow'
import { connectionLabel } from '@/services/mcp/list-connections'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'

export const TRUNCATED_VALUE = '[TRUNCATED]'
const MAX_STRING_LENGTH = 500
const MAX_ARRAY_LENGTH = 40
const MAX_DEPTH = 6

export type FailedStepView = {
  appKey: string
  stepKey: string
  type: string
  status: string
  connectionLabel: string | null
  fields: Array<{
    key: string
    label: string
    type: string
    required: boolean
    description?: string
  }>
  parameters: IJSONObject
}

type ReadableStep = {
  id: string
  flowId: string
  appKey?: string
  key?: string
  type: string
  status: string
  parameters?: IJSONObject
  connection?: {
    formattedData?: IJSONObject
    description?: string
    key: string
  } | null
}

function holdsCredentials(value: IJSONValue | undefined): boolean {
  return value !== undefined && !isEqual(redactCredentials(value), value)
}

function containsPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(REDACTED_VALUE) || value.includes(TRUNCATED_VALUE)
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsPlaceholder)
  }
  return false
}

function truncateStepValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return TRUNCATED_VALUE
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}${TRUNCATED_VALUE}`
      : value
  }
  if (Array.isArray(value)) {
    const visible = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => truncateStepValue(item, depth + 1))
    if (value.length > MAX_ARRAY_LENGTH) {
      visible.push(TRUNCATED_VALUE)
    }
    return visible
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        truncateStepValue(nested, depth + 1),
      ]),
    )
  }
  return value
}

function fieldDefinitions(
  appKey: string | undefined,
  stepKey: string | undefined,
  type: string,
): IField[] {
  const app = appKey ? apps[appKey] : undefined
  const definitions = type === 'trigger' ? app?.triggers : app?.actions
  const match = definitions?.find((item) => item.key === stepKey) as
    | IRawAction
    | IRawTrigger
    | undefined
  return match?.arguments ?? []
}

export function replaceParameterKeysWithLabels(
  summary: string,
  appKey: string,
  stepKey: string,
): string {
  const fields = [
    ...fieldDefinitions(appKey, stepKey, 'action'),
    ...fieldDefinitions(appKey, stepKey, 'trigger'),
  ].sort((left, right) => right.key.length - left.key.length)

  return fields.reduce((text, field) => {
    const label = field.label || field.key
    if (label === field.key) {
      return text
    }
    const key = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.replace(new RegExp(`\\b${key}\\b`, 'g'), label)
  }, summary)
}

export function presentFailedStep(step: ReadableStep): FailedStepView {
  const fields = fieldDefinitions(step.appKey, step.key, step.type).map(
    (field) => ({
      key: field.key,
      label: field.label || field.key,
      type: field.type,
      required: field.required ?? false,
      ...(field.description
        ? { description: field.description.slice(0, 180) }
        : {}),
    }),
  )

  return {
    appKey: step.appKey ?? '',
    stepKey: step.key ?? '',
    type: step.type,
    status: step.status,
    connectionLabel: step.connection ? connectionLabel(step.connection) : null,
    fields,
    parameters: truncateStepValue(
      redactCredentials(step.parameters ?? {}),
    ) as IJSONObject,
  }
}

/**
 * Reads only the step that failed this Check. The model cannot pick another id.
 */
export async function readFailedStep(
  user: User,
  stepId: string,
  expected: { appKey: string; stepKey: string },
): Promise<FailedStepView | { error: string }> {
  const step = (await user
    .withAccessibleSteps({ requiredRole: 'viewer' })
    .findById(stepId)
    .withGraphFetched('connection')) as ReadableStep | undefined

  if (!step) {
    return { error: 'The step could not be read.' }
  }
  if (step.appKey !== expected.appKey || step.key !== expected.stepKey) {
    return { error: 'The step does not match this Check step.' }
  }
  return presentFailedStep(step)
}

export async function updateFailedStepParameters(
  user: User,
  stepId: string,
  expected: { appKey: string; stepKey: string },
  parameters: Record<string, unknown>,
  traceId: string,
): Promise<{ updated: true } | { error: string }> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .findById(stepId)

  if (!step) {
    return { error: 'The step could not be updated.' }
  }
  if (step.appKey !== expected.appKey || step.key !== expected.stepKey) {
    return { error: 'The step does not match this Check step.' }
  }
  if (
    Object.keys(parameters).some(
      (key) =>
        SECRET_KEY_REGEXP.test(key) || holdsCredentials(step.parameters?.[key]),
    )
  ) {
    return { error: 'AI cannot safely update a field with protected values.' }
  }
  // IMPORTANT: get_step shows a lossy copy, so writing a marker back would overwrite the real value.
  if (containsPlaceholder(parameters)) {
    return { error: 'AI cannot update a field it could not fully read.' }
  }

  const before = step.parameters ?? {}
  const result = await updateStepParametersService({
    user,
    pipeId: step.flowId,
    stepId,
    parameters,
    traceId,
  })

  const changed = Object.keys(parameters).some(
    (key) => !isEqual(before[key], result.step.parameters[key]),
  )
  if (!changed) {
    return { error: 'No step parameters were changed.' }
  }

  return { updated: true }
}
