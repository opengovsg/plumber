import type { IFlowCollabRole } from '@plumber/types'

import type { ServerEvent } from '@/helpers/server-events'

export type FlowCollaboratorChange =
  | { type: 'added'; role: IFlowCollabRole }
  | {
      type: 'role_changed'
      role: IFlowCollabRole
      previousRole: IFlowCollabRole
    }
  | { type: 'removed'; previousRole: IFlowCollabRole }

// `left` is a collaborator removing themself. A transfer makes the old owner an editor and drops the new owner's collaborator row.
export type FlowCollaboratorSource = 'app' | 'left' | 'transfer'

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

interface FlowCollaboratorEventInput {
  actorUserId: string
  flowId: string
  collaboratorUserId: string
  change: FlowCollaboratorChange
  source: FlowCollaboratorSource
}

/**
 * Builds the event for a collaborator change that has committed.
 *
 * flow_collaborators overwrites a row on a role change or re-add, so these events are the only history.
 */
export function buildFlowCollaboratorEvent({
  actorUserId,
  flowId,
  collaboratorUserId,
  change,
  source,
}: FlowCollaboratorEventInput): ServerEvent {
  const base = {
    flow_id: flowId,
    collaborator_user_id: collaboratorUserId,
    source,
  }
  switch (change.type) {
    case 'added':
      return {
        distinctId: actorUserId,
        event: 'flow_collaborator_added',
        properties: { ...base, role: change.role },
      }
    case 'role_changed':
      return {
        distinctId: actorUserId,
        event: 'flow_collaborator_role_changed',
        properties: {
          ...base,
          role: change.role,
          previous_role: change.previousRole,
        },
      }
    case 'removed':
      return {
        distinctId: actorUserId,
        event: 'flow_collaborator_removed',
        properties: { ...base, previous_role: change.previousRole },
      }
  }
}
