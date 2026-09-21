import type { IJSONObject, IStepConfig } from '@plumber/types'

import type User from '@/models/user'

export interface McpStep {
  id: string
  key: string | null
  appKey: string | null
  type: 'trigger' | 'action'
  parameters: IJSONObject
  position: number
  status: string
  config: IStepConfig | null
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

/**
 * Mirrors the getFlow GraphQL query (packages/backend/src/graphql/queries/get-flow.ts)
 * so the AI Builder can discover steps it didn't create itself — notably the
 * hidden FormSG MRF steps that only appear after the trigger has been tested.
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
      parameters: step.parameters,
      position: step.position,
      status: step.status,
      config: step.config ?? null,
      connectionId: step.connectionId ?? null,
    })),
  }
}
