import { BaseFlow, BaseFlowCollaborator } from '@plumber/backend-models'
import { z } from 'zod'

import type { SilverTable } from '../silver-table'

const flowAccessRowSchema = z.object({
  user_id: z.string(),
  flow_id: z.string(),
  role: z.string(),
  created_at: z.date(),
  deleted_at: z.date().nullable(),
})

export type FlowAccessRow = z.infer<typeof flowAccessRowSchema>

type CollaboratorOnFlow = BaseFlowCollaborator & {
  flowDeletedAt: string | null
}

// An owner row is the current owner dated from the pipe's creation. Join flow_transfer for handovers.
export function toOwnerAccessRow(flow: BaseFlow): unknown {
  return {
    user_id: flow.userId,
    flow_id: flow.id,
    role: 'owner',
    created_at: flow.createdAt,
    deleted_at: flow.deletedAt,
  }
}

// Removing a collaborator sets deleted_at and keeps the row, so past access stays countable.
// Deleting a pipe leaves its collaborator rows untouched, so their access ends with the pipe.
export function toCollaboratorAccessRow(
  collaborator: CollaboratorOnFlow,
): unknown {
  return {
    user_id: collaborator.userId,
    flow_id: collaborator.flowId,
    role: collaborator.role,
    created_at: collaborator.createdAt,
    deleted_at: collaborator.deletedAt ?? collaborator.flowDeletedAt,
  }
}

function byFlowThenCreated(a: FlowAccessRow, b: FlowAccessRow): number {
  if (a.flow_id !== b.flow_id) {
    return a.flow_id < b.flow_id ? -1 : 1
  }
  return a.created_at.getTime() - b.created_at.getTime()
}

export const flowAccessTable: SilverTable<FlowAccessRow> = {
  name: 'flow_access',
  columns: {
    user_id: 'STRING',
    flow_id: 'STRING',
    role: 'STRING',
    created_at: 'TIMESTAMP',
    deleted_at: 'TIMESTAMP',
  },
  // flow_collaborators holds editors and viewers only. The owner comes from flows.user_id.
  fetchRows: async (db) => {
    const [flows, collaborators] = await Promise.all([
      BaseFlow.query(db)
        .withSoftDeleted()
        .whereNotNull('user_id')
        .select('id', 'user_id', 'created_at', 'deleted_at'),
      BaseFlowCollaborator.query(db)
        .withSoftDeleted()
        .join('flows', 'flows.id', 'flow_collaborators.flow_id')
        .select(
          'flow_collaborators.user_id',
          'flow_collaborators.flow_id',
          'flow_collaborators.role',
          'flow_collaborators.created_at',
          'flow_collaborators.deleted_at',
          'flows.deleted_at as flow_deleted_at',
        )
        .castTo<CollaboratorOnFlow[]>(),
    ])
    const rows = z
      .array(flowAccessRowSchema)
      .parse([
        ...flows.map(toOwnerAccessRow),
        ...collaborators.map(toCollaboratorAccessRow),
      ])
    return rows.sort(byFlowThenCreated)
  },
}
