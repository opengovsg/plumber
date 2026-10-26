import { randomUUID } from 'crypto'

import { describe, expect, it, vi } from 'vitest'

import { tilesClient } from '@/config/tiles-database'
import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import {
  checkIfTableExists,
  checkIfTableHasColumn,
} from '@/graphql/__tests__/mutations/tiles/tiles-pg-helper'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import * as pgTableFunctions from '@/models/tiles/pg/table-functions'

import { createTileInTransaction } from '../create-tile'

describe('createTileInTransaction', () => {
  it('creates a tile with zero columns and no rows', async () => {
    const context = await generateMockContext()
    const name = `blank-${randomUUID()}`

    const table = await TableMetadata.transaction(async (trx) => {
      return createTileInTransaction(trx, {
        user: context.currentUser,
        name,
        columns: [],
      })
    })

    const stored = await TableMetadata.query()
      .findById(table.id)
      .withGraphFetched('columns')
    const owner = await TableCollaborator.query().findOne({
      user_id: context.currentUser.id,
      table_id: table.id,
    })

    expect(stored?.name).toBe(name)
    expect(stored?.db).toBe('pg')
    expect(stored?.config).toEqual({})
    expect(stored?.columns).toEqual([])
    expect(owner?.role).toBe('owner')
    expect(await checkIfTableExists(table.id)).toBe(true)
    expect(await tilesClient(table.id).select('*')).toEqual([])
  })

  it('creates a tile with three columns and the given config', async () => {
    const context = await generateMockContext()
    const name = `three-${randomUUID()}`
    const columnConfig = {
      aiBuilderConfig: {
        traceId: 'trace-create',
        tool: 'create_tile' as const,
      },
    }

    const table = await TableMetadata.transaction(async (trx) => {
      return createTileInTransaction(trx, {
        user: context.currentUser,
        name,
        config: { aiBuilderConfig: { traceId: 'trace-create' } },
        columns: [
          { name: 'Applicant', position: 0 },
          { name: 'Start', position: 1, config: columnConfig },
          { name: 'End', position: 2 },
        ],
      })
    })

    const stored = await TableMetadata.query()
      .findById(table.id)
      .withGraphFetched('columns')
    const columns = stored?.columns ?? []

    expect(stored?.config).toEqual({
      aiBuilderConfig: { traceId: 'trace-create' },
    })
    expect(columns.map((column) => column.name)).toEqual([
      'Applicant',
      'Start',
      'End',
    ])
    expect(columns.map((column) => column.position)).toEqual([0, 1, 2])
    expect(columns[0].config).toEqual({})
    expect(columns[1].config).toEqual(columnConfig)
    expect(columns[2].config).toEqual({})
    expect(await checkIfTableExists(table.id)).toBe(true)
    expect(
      await Promise.all(
        columns.map((column) => checkIfTableHasColumn(table.id, column.id)),
      ),
    ).toEqual([true, true, true])
    expect(await tilesClient(table.id).select('*')).toEqual([])
  })

  it('rolls back metadata when Postgres table creation fails', async () => {
    const context = await generateMockContext()
    const name = `rollback-${randomUUID()}`
    let tableId: string | undefined
    const spy = vi
      .spyOn(pgTableFunctions, 'createTable')
      .mockImplementation((id) => {
        tableId = id
        return tilesClient.raw('CREATE TABLE') as unknown as ReturnType<
          typeof pgTableFunctions.createTable
        >
      })

    try {
      await expect(
        TableMetadata.transaction(async (trx) => {
          return createTileInTransaction(trx, {
            user: context.currentUser,
            name,
            columns: [{ name: 'Applicant', position: 0 }],
          })
        }),
      ).rejects.toThrow()
    } finally {
      spy.mockRestore()
    }

    expect(tableId).toBeDefined()
    expect(await TableMetadata.query().findById(tableId)).toBeUndefined()
    expect(await TableMetadata.query().where({ name })).toEqual([])
    expect(
      await TableColumnMetadata.query().where('table_id', tableId),
    ).toEqual([])
    expect(await TableCollaborator.query().where('table_id', tableId)).toEqual(
      [],
    )
    expect(await checkIfTableExists(tableId)).toBe(false)
  })
})
