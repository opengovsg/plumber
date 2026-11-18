import type { IFlowCollabRole } from '@plumber/types'
import type { Transaction } from 'objection'

import {
  captureFlowEvent,
  type FlowCollaboratorSource,
} from '@/helpers/flow-events'

export type FlowCollaboratorChange =
  | { type: 'added'; role: IFlowCollabRole }
  | {
      type: 'role_changed'
      role: IFlowCollabRole
      previousRole: IFlowCollabRole
    }
  | { type: 'removed'; previousRole: IFlowCollabRole }

interface ExistingCollaborator {
  role: IFlowCollabRole
  deletedAt: string | null
}

/**
 * Classifies an upsert against the collaborator row it found, soft-deleted rows included.
 *
 * Returns null when nothing changes, so a repeated save sends no event.
 */
export function classifyCollaboratorUpsert(
  existing: ExistingCollaborator | undefined,
  role: IFlowCollabRole,
): FlowCollaboratorChange | null {
  if (!existing || existing.deletedAt) {
    return { type: 'added', role }
  }
  if (existing.role === role) {
    return null
  }
  return { type: 'role_changed', role, previousRole: existing.role }
}

interface CollaboratorChangeInput {
  actorUserId: string
  flowId: string
  collaboratorUserId: string
  change: FlowCollaboratorChange
  source: FlowCollaboratorSource
  trx?: Transaction
}

/**
 * Sends the event for a collaborator change.
 *
 * flow_collaborators overwrites a row on a role change or re-add, so these events are the only history.
 */
export function captureCollaboratorChange({
  actorUserId,
  flowId,
  collaboratorUserId,
  change,
  source,
  trx,
}: CollaboratorChangeInput): void {
  const common = { actorUserId, flowId, trx }
  switch (change.type) {
    case 'added':
      captureFlowEvent({
        ...common,
        event: 'flow_collaborator_added',
        properties: {
          collaborator_user_id: collaboratorUserId,
          role: change.role,
          source,
        },
      })
      return
    case 'role_changed':
      captureFlowEvent({
        ...common,
        event: 'flow_collaborator_role_changed',
        properties: {
          collaborator_user_id: collaboratorUserId,
          role: change.role,
          previous_role: change.previousRole,
          source,
        },
      })
      return
    case 'removed':
      captureFlowEvent({
        ...common,
        event: 'flow_collaborator_removed',
        properties: {
          collaborator_user_id: collaboratorUserId,
          previous_role: change.previousRole,
          source,
        },
      })
  }
}
