import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'
import User from '@/models/user'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '../../../graphql/__tests__/mutations/tiles/table.mock'
import { addTileColumnsService } from '../add-tile-columns'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue('pg'),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

describe('addTileColumnsService', () => {
  beforeEach(() => {
    mocks.getLdFlagValue.mockResolvedValue('pg')
  })

  it('adds new columns and skips names that already exist', async () => {
    const context = await generateMockContext()
    const { table } = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })
    await generateMockTableColumns({
      tableId: table.id,
      numColumns: 1,
      databaseType: 'pg',
    })

    const result = await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Test Column 0', 'New column'],
    })

    expect(result.skipped).toEqual(['Test Column 0'])
    expect(result.columns.map((column) => column.name)).toContain('New column')
    expect(result.columns.map((column) => column.name)).toContain(
      'Test Column 0',
    )
  })

  it('rejects viewers', async () => {
    const context = await generateMockContext()
    const { table, viewer } = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })

    await expect(
      addTileColumnsService({
        user: viewer,
        tableId: table.id,
        columns: ['Secret'],
      }),
    ).rejects.toBeInstanceOf(UserFacingError)
  })

  it('rejects users with no access', async () => {
    const context = await generateMockContext()
    const { table } = await generateMockTable({
      userId: context.currentUser.id,
      databaseType: 'pg',
    })
    const stranger = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `stranger-${randomUUID()}@open.gov.sg`,
    })

    await expect(
      addTileColumnsService({
        user: stranger,
        tableId: table.id,
        columns: ['Secret'],
      }),
    ).rejects.toBeInstanceOf(UserFacingError)
  })
})
