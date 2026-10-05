import type { IJSONObject, IJSONValue, IStepConfig } from '@plumber/types'

import { hasStepVariable } from '@/apps/custom-api/common/sensitive-headers'
import { SECRET_KEY_REGEXP } from '@/helpers/redaction/sensitive-keys'
import type User from '@/models/user'

export const REDACTED_VALUE = '[REDACTED]'

export interface McpStep {
  id: string
  key: string | null
  appKey: string | null
  type: 'trigger' | 'action'
  parameters: IJSONObject
  position: number
  status: string
  config: Pick<IStepConfig, 'stepName' | 'approval' | 'endStepId'> | null
  connectionId: string | null
}

export interface McpFlow {
  id: string
  name: string
  active: boolean
  steps: McpStep[]
}

export interface GetFlowInput {
  user: User
  pipeId: string
}

function isKeyValueRow(
  value: IJSONObject,
): value is IJSONObject & { key: string; value: IJSONValue } {
  return typeof value.key === 'string' && 'value' in value
}

/**
 * Strips stored credentials before parameters reach the model context.
 *
 * Existing steps may still hold static secrets in Custom Headers, which are plain text.
 */
function redactCredentials(value: IJSONValue): IJSONValue {
  if (Array.isArray(value)) {
    return value.map(redactCredentials)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (
    isKeyValueRow(value) &&
    SECRET_KEY_REGEXP.test(value.key) &&
    !(typeof value.value === 'string' && hasStepVariable(value.value))
  ) {
    return { ...value, value: REDACTED_VALUE }
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY_REGEXP.test(key) ? REDACTED_VALUE : redactCredentials(nested),
    ]),
  )
}

/**
 * Mirrors the getFlow GraphQL query (packages/backend/src/graphql/queries/get-flow.ts)
 * so the AI Builder can read a pipe's steps, including the hidden FormSG MRF
 * stage steps that Plumber creates.
 */
export async function getFlowService({
  user,
  pipeId,
}: GetFlowInput): Promise<McpFlow> {
  const flow = await user
    .withAccessibleFlows({ requiredRole: 'viewer' })
    .withGraphFetched({ steps: true })
    .findOne({ 'flows.id': pipeId })
    .throwIfNotFound()

  const steps = [...flow.steps].sort((a, b) => a.position - b.position)

  return {
    id: flow.id,
    name: flow.name,
    active: flow.active,
    steps: steps.map((step) => ({
      id: step.id,
      key: step.key,
      appKey: step.appKey,
      type: step.type,
      parameters: redactCredentials(step.parameters ?? {}) as IJSONObject,
      position: step.position,
      status: step.status,
      config: step.config
        ? {
            stepName: step.config.stepName,
            approval: step.config.approval,
            endStepId: step.config.endStepId,
          }
        : null,
      connectionId: step.connectionId ?? null,
    })),
  }
}
