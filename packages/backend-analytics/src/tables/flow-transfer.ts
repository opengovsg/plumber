import { BaseFlowTransfer } from '@plumber/backend-models'
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
    // flow_transfers forbids soft deletes, so this only skips the soft-delete filter's column check.
    const transfers = await BaseFlowTransfer.query(db)
      .withSoftDeleted()
      .orderBy('created_at')
    return z
      .array(flowTransferRowSchema)
      .parse(transfers.map(toFlowTransferRow))
  },
}

export function toFlowTransferRow(transfer: BaseFlowTransfer): unknown {
  return {
    flow_id: transfer.flowId,
    old_owner_user_id: transfer.oldOwnerId,
    new_owner_user_id: transfer.newOwnerId,
    status: transfer.status,
    created_at: transfer.createdAt,
    updated_at: transfer.updatedAt,
  }
}
