import { z } from 'zod'

import type { SilverTable } from '../silver-table'

const flowAccessRowSchema = z.object({
  user_id: z.string(),
  flow_id: z.string(),
  role: z.string(),
  created_at: z.date(),
  deleted_at: z.date().nullable(),
  last_accessed_at: z.date().nullable(),
})

export type FlowAccessRow = z.infer<typeof flowAccessRowSchema>

// flow_collaborators holds editors and viewers only. The owner comes from flows.user_id.
// An owner row is the current owner dated from the pipe's creation. Join flow_transfer for handovers.
// Removing a collaborator sets deleted_at and keeps the row, so past access stays countable.
const FLOW_ACCESS_SQL = `
  SELECT
    f.user_id,
    f.id AS flow_id,
    'owner' AS role,
    f.created_at,
    f.deleted_at,
    NULL::timestamptz AS last_accessed_at
  FROM flows f
  WHERE f.user_id IS NOT NULL
  UNION ALL
  SELECT
    c.user_id,
    c.flow_id,
    c.role,
    c.created_at,
    c.deleted_at,
    c.last_accessed_at
  FROM flow_collaborators c
  ORDER BY flow_id, created_at
`

export const flowAccessTable: SilverTable<FlowAccessRow> = {
  name: 'flow_access',
  columns: {
    user_id: 'STRING',
    flow_id: 'STRING',
    role: 'STRING',
    created_at: 'TIMESTAMP',
    deleted_at: 'TIMESTAMP',
    last_accessed_at: 'TIMESTAMP',
  },
  fetchRows: async (db) => {
    const result = await db.raw(FLOW_ACCESS_SQL)
    return z.array(flowAccessRowSchema).parse(result.rows)
  },
}
