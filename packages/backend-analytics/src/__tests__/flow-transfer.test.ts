import { BaseFlowTransfer } from '@plumber/backend-models'
import { describe, expect, it } from 'vitest'

import { flowTransferTable, toFlowTransferRow } from '../tables/flow-transfer'

describe('toFlowTransferRow', () => {
  it('maps owner ids to user id columns and leaves no other column', () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z')
    const transfer = BaseFlowTransfer.fromDatabaseJson({
      id: 'transfer-1',
      flow_id: 'flow-1',
      old_owner_id: 'user-old',
      new_owner_id: 'user-new',
      status: 'approved',
      created_at: createdAt,
      updated_at: createdAt,
    })

    const row = toFlowTransferRow(transfer)

    expect(row).toEqual({
      flow_id: 'flow-1',
      old_owner_user_id: 'user-old',
      new_owner_user_id: 'user-new',
      status: 'approved',
      created_at: createdAt,
      updated_at: createdAt,
    })
    expect(Object.keys(row as object).sort()).toEqual(
      Object.keys(flowTransferTable.columns).sort(),
    )
  })
})
