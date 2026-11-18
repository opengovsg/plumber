import { z } from 'zod'

import type { SilverTable } from '../silver-table'

const flowTransferRowSchema = z.object({
  flow_id: z.string(),
  old_owner_user_id: z.string(),
  new_owner_user_id: z.string(),
  status: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
})

export type FlowTransferRow = z.infer<typeof flowTransferRowSchema>

/**
 * A handover makes the old owner look lapsed and the new owner newly activated.
 * The north star joins this table by flow_id to re-attribute them.
 */
export const flowTransferTable: SilverTable<FlowTransferRow> = {
  name: 'flow_transfer',
  columns: {
    flow_id: 'STRING',
    old_owner_user_id: 'STRING',
    new_owner_user_id: 'STRING',
    status: 'STRING',
    created_at: 'TIMESTAMP',
    updated_at: 'TIMESTAMP',
  },
  fetchRows: async (db) => {
    const rows = await db('flow_transfers')
      .select(
        'flow_id',
        'old_owner_id as old_owner_user_id',
        'new_owner_id as new_owner_user_id',
        'status',
        'created_at',
        'updated_at',
      )
      .orderBy('created_at')
    return z.array(flowTransferRowSchema).parse(rows)
  },
}
