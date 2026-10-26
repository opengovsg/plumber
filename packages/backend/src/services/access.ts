import type { IFlowCollabRole } from '@plumber/types'
import type { RelationExpression, Transaction } from 'objection'

import type Flow from '@/models/flow'
import type Step from '@/models/step'
import type User from '@/models/user'

interface LoadAccessibleFlowInput {
  user: User
  flowId: string
  role: IFlowCollabRole
  graph?: RelationExpression<Flow>
  trx?: Transaction
}

interface LoadAccessibleStepInput {
  user: User
  stepId: string
  flowId?: string
  role: IFlowCollabRole
  graph?: RelationExpression<Step>
  trx?: Transaction
}

interface LoadAccessibleStepsInput {
  user: User
  stepIds: string[]
  role: IFlowCollabRole
  graph?: RelationExpression<Step>
  trx?: Transaction
}

function accessibleStepsQuery({
  user,
  role,
  graph,
  trx,
}: Pick<LoadAccessibleStepsInput, 'user' | 'role' | 'graph' | 'trx'>) {
  const query = user.withAccessibleSteps({ requiredRole: role, trx })
  if (graph) {
    query.withGraphFetched(graph)
  }
  return query
}

export async function loadAccessibleFlow({
  user,
  flowId,
  role,
  graph,
  trx,
}: LoadAccessibleFlowInput): Promise<Flow | undefined> {
  const query = user.withAccessibleFlows({ requiredRole: role, trx })
  if (graph) {
    query.withGraphFetched(graph)
  }

  return query.findOne({ 'flows.id': flowId })
}

export async function loadAccessibleStep({
  user,
  stepId,
  flowId,
  role,
  graph,
  trx,
}: LoadAccessibleStepInput): Promise<Step | undefined> {
  return accessibleStepsQuery({ user, role, graph, trx }).findOne({
    'steps.id': stepId,
    ...(flowId ? { 'steps.flow_id': flowId } : {}),
  })
}

export async function loadAccessibleSteps({
  user,
  stepIds,
  role,
  graph,
  trx,
}: LoadAccessibleStepsInput): Promise<Step[]> {
  const uniqueStepIds = [...new Set(stepIds)]
  if (uniqueStepIds.length === 0) {
    return []
  }

  return accessibleStepsQuery({ user, role, graph, trx }).whereIn(
    'steps.id',
    uniqueStepIds,
  )
}
