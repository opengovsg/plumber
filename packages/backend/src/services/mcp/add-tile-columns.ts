import { ForbiddenError } from '@/errors/graphql-errors'
import { UserFacingError } from '@/errors/user-facing-error'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import type User from '@/models/user'

import { parseColumnNames, type TileColumnResult } from './tile-column-names'

export interface AddTileColumnsInput {
  user: User
  tableId: string
  columns: string[]
}

export interface AddTileColumnsResult {
  id: string
  name: string
  columns: TileColumnResult[]
  skipped: string[]
}

export async function addTileColumnsService({
  user,
  tableId,
  columns,
}: AddTileColumnsInput): Promise<AddTileColumnsResult> {
  const columnNames = parseColumnNames(columns)

  try {
    await TableCollaborator.hasAccess(user.id, tableId, 'editor')
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new UserFacingError(
        'You do not have permission to add columns to this Tile',
      )
    }
    throw error
  }

  const table = await TableMetadata.query().findById(tableId)
  if (!table) {
    throw new UserFacingError('Tile not found')
  }

  const existing = await table.$relatedQuery('columns')
  const existingKeys = new Set(
    existing.map((column) => column.name.toLowerCase()),
  )

  const skipped: string[] = []
  const toAdd: string[] = []
  for (const name of columnNames) {
    if (existingKeys.has(name.toLowerCase())) {
      skipped.push(name)
    } else {
      toAdd.push(name)
    }
  }

  if (toAdd.length) {
    const tableOperations = getTableOperations(table.db)
    await TableColumnMetadata.transaction(async (trx) => {
      const results = await table
        .$relatedQuery('columns', trx)
        .max('position as position')
      const maxPosition = results[0].position || 0
      const inserted = await table
        .$relatedQuery('columns', trx)
        .insert(
          toAdd.map((name, i) => ({
            name,
            position: maxPosition + i + 1,
          })),
        )
        .returning('id')

      await tableOperations.createTableColumns(
        tableId,
        inserted.map((column) => column.id),
      )
    })
  }

  const updated = await table.$fetchGraph('columns')

  return {
    id: updated.id,
    name: updated.name,
    columns: updated.columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
    })),
    skipped,
  }
}
