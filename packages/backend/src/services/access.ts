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
  const query = user.withAccessibleSteps({ requiredRole: role, trx })
  if (graph) {
    query.withGraphFetched(graph)
  }

  return query.findOne({
    'steps.id': stepId,
    ...(flowId ? { 'steps.flow_id': flowId } : {}),
  })
}
