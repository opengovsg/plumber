import { ForbiddenError } from '@/errors/graphql-errors'
import { UserFacingError } from '@/errors/user-facing-error'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import type User from '@/models/user'
import { appendTileColumns } from '@/services/tiles/append-columns'

import { createColumnAiBuilderConfig } from './tile-ai-builder-config'
import {
  parseAddTileColumnsInput,
  type TileColumnResult,
} from './tile-column-names'

export interface AddTileColumnsInput {
  user: User
  tableId: string
  columns: string[]
  traceId?: string
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
  traceId,
}: AddTileColumnsInput): Promise<AddTileColumnsResult> {
  const { tableId: parsedTableId, columns: columnNames } =
    parseAddTileColumnsInput({ tableId, columns })

  try {
    await TableCollaborator.hasAccess(user.id, parsedTableId, 'editor')
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new UserFacingError(
        'You do not have permission to add columns to this Tile',
      )
    }
    throw error
  }

  const table = await TableMetadata.query().findById(parsedTableId)
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
    await appendTileColumns({
      table,
      names: toAdd,
      ...(traceId && {
        columnConfig: createColumnAiBuilderConfig(traceId, 'add_tile_columns'),
      }),
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
