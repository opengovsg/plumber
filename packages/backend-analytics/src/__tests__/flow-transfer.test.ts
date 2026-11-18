import type { Knex } from 'knex'
import { describe, expect, it, vi } from 'vitest'

import { flowTransferTable } from '../tables/flow-transfer'

function makeDb(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows)
  const select = vi.fn().mockReturnValue({ orderBy })
  const db = vi.fn().mockReturnValue({ select })
  return { db: db as unknown as Knex, select, tableName: db }
}

describe('flowTransferTable.fetchRows', () => {
  it('maps owner ids to user id columns and leaves no other column', async () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z')
    const { db, select, tableName } = makeDb([
      {
        flow_id: 'flow-1',
        old_owner_user_id: 'user-old',
        new_owner_user_id: 'user-new',
        status: 'approved',
        created_at: createdAt,
        updated_at: createdAt,
      },
    ])

    const rows = await flowTransferTable.fetchRows(db)

    expect(tableName).toHaveBeenCalledWith('flow_transfers')
    expect(select).toHaveBeenCalledWith(
      'flow_id',
      'old_owner_id as old_owner_user_id',
      'new_owner_id as new_owner_user_id',
      'status',
      'created_at',
      'updated_at',
    )
    expect(Object.keys(rows[0]).sort()).toEqual(
      Object.keys(flowTransferTable.columns).sort(),
    )
  })

  it('rejects a row whose shape changed', async () => {
    const { db } = makeDb([{ flow_id: 'flow-1', status: 'approved' }])

    await expect(flowTransferTable.fetchRows(db)).rejects.toThrow()
  })
})
