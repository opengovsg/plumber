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

  it('appends aiBuilderConfig.addTileColumns without inventing createTile', async () => {
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

    const first = await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Notes'],
      traceId: 'trace-add-1',
    })
    const notesId = first.columns.find((column) => column.name === 'Notes')?.id

    const second = await addTileColumnsService({
      user: context.currentUser,
      tableId: table.id,
      columns: ['Priority'],
      traceId: 'trace-add-2',
    })
    const priorityId = second.columns.find(
      (column) => column.name === 'Priority',
    )?.id

    const stored = await TableMetadata.query().findById(table.id)
    expect(notesId).toBeDefined()
    expect(priorityId).toBeDefined()
    expect(stored?.config).toEqual({
      aiBuilderConfig: {
        addTileColumns: [
          { traceId: 'trace-add-1', addedColumnIds: [notesId] },
          { traceId: 'trace-add-2', addedColumnIds: [priorityId] },
        ],
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

  it('keeps createTile when add_tile_columns runs on an AI-created tile', async () => {
    const context = await generateMockContext()
    const created = await createTileService({
      user: context.currentUser,
      name: 'AI Tile',
      columns: ['Status'],
      traceId: 'trace-create',
    })

    const added = await addTileColumnsService({
      user: context.currentUser,
      tableId: created.id,
      columns: ['Extra'],
      traceId: 'trace-add',
    })
    const extraId = added.columns.find((column) => column.name === 'Extra')?.id

    const stored = await TableMetadata.query().findById(created.id)
    expect(extraId).toBeDefined()
    expect(stored?.config).toEqual({
      aiBuilderConfig: {
        createTile: { traceId: 'trace-create' },
        addTileColumns: [{ traceId: 'trace-add', addedColumnIds: [extraId] }],
      },
    })
  })

  it('keeps both addTileColumns records when two calls run in parallel', async () => {
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

    const [first, second] = await Promise.all([
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

    const notesId = first.columns.find((column) => column.name === 'Notes')?.id
    const priorityId = second.columns.find(
      (column) => column.name === 'Priority',
    )?.id
    const stored = await TableMetadata.query().findById(table.id)
    const adds = stored?.config?.aiBuilderConfig?.addTileColumns ?? []

    expect(notesId).toBeDefined()
    expect(priorityId).toBeDefined()
    expect(adds).toHaveLength(2)
    expect(adds).toEqual(
      expect.arrayContaining([
        { traceId: 'trace-parallel-1', addedColumnIds: [notesId] },
        { traceId: 'trace-parallel-2', addedColumnIds: [priorityId] },
      ]),
    )
    expect(stored?.config?.aiBuilderConfig?.createTile).toBeUndefined()
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
