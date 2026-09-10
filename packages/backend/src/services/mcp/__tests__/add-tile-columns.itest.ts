import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFacingError } from '@/errors/user-facing-error'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'

import {
  generateMockContext,
  generateMockTable,
  generateMockTableColumns,
} from '../../../graphql/__tests__/mutations/tiles/table.mock'
import { addTileColumnsService } from '../add-tile-columns'
import { createTileService } from '../create-tile'

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

    const stored = await TableMetadata.query().findById(table.id)
    expect(stored?.config).toEqual({})
  })

  it('stamps each added column without updating the tile config', async () => {
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

    await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Notes'],
      traceId: 'trace-add-1',
    })

    await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Priority'],
      traceId: 'trace-add-2',
    })

    const stored = await TableMetadata.query()
      .findById(table.id)
      .withGraphFetched('columns')
    const notes = stored?.columns.find((column) => column.name === 'Notes')
    const priority = stored?.columns.find(
      (column) => column.name === 'Priority',
    )

    expect(stored?.config).toEqual({})
    expect(notes?.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-add-1',
        tool: 'add_tile_columns',
      },
    })
    expect(priority?.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-add-2',
        tool: 'add_tile_columns',
      },
    })
  })

  it('does not stamp config when every column name is skipped', async () => {
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

    await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Test Column 0'],
      traceId: 'trace-skip',
    })

    const stored = await TableMetadata.query().findById(table.id)
    expect(stored?.config).toEqual({})
  })

  it('keeps the tile trace when add_tile_columns runs', async () => {
    const context = await generateMockContext()
    const created = await createTileService({
      user: context.currentUser,
      name: 'AI Tile',
      columns: ['Status'],
      traceId: 'trace-create',
    })

    await addTileColumnsService({
      user: context.currentUser,
      tableId: created.id,
      columns: ['Extra'],
      traceId: 'trace-add',
    })

    const stored = await TableMetadata.query()
      .findById(created.id)
      .withGraphFetched('columns')
    const status = stored?.columns.find((column) => column.name === 'Status')
    const extra = stored?.columns.find((column) => column.name === 'Extra')

    expect(stored?.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-create',
      },
    })
    expect(status?.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-create',
        tool: 'create_tile',
      },
    })
    expect(extra?.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-add',
        tool: 'add_tile_columns',
      },
    })
  })

  it('stamps columns from parallel add_tile_columns calls', async () => {
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

    await Promise.all([
      addTileColumnsService({
        user: context.currentUser,
        tableId: table.id,
        columns: ['Notes'],
        traceId: 'trace-parallel-1',
      }),
      addTileColumnsService({
        user: context.currentUser,
        tableId: table.id,
        columns: ['Priority'],
        traceId: 'trace-parallel-2',
      }),
    ])

    const stored = await TableMetadata.query()
      .findById(table.id)
      .withGraphFetched('columns')
    const notes = stored?.columns.find((column) => column.name === 'Notes')
    const priority = stored?.columns.find(
      (column) => column.name === 'Priority',
    )

    expect(notes?.config.aiBuilderConfig).toEqual({
      traceId: 'trace-parallel-1',
      tool: 'add_tile_columns',
    })
    expect(priority?.config.aiBuilderConfig).toEqual({
      traceId: 'trace-parallel-2',
      tool: 'add_tile_columns',
    })
    expect(stored?.config).toEqual({})
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
