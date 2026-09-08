import { UserFacingError } from '@/errors/user-facing-error'
import { addFlowTableConnection } from '@/helpers/add-flow-connection'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import { type DatabaseType } from '@/models/tiles/types'
import type User from '@/models/user'

import { createTileAiBuilderConfig } from './tile-ai-builder-config'
import {
  parseCreateTileInput,
  type TileColumnResult,
} from './tile-column-names'

const DATABASE_TYPE_LD_FLAG_KEY = 'tiles-database-type'

export interface CreateTileInput {
  user: User
  name: string
  columns: string[]
  pipeId?: string
  traceId?: string
}

export interface CreateTileResult {
  id: string
  name: string
  columns: TileColumnResult[]
}

export async function createTileService({
  user,
  name,
  columns,
  pipeId,
  traceId,
}: CreateTileInput): Promise<CreateTileResult> {
  const {
    name: tableName,
    columns: columnNames,
    pipeId: parsedPipeId,
  } = parseCreateTileInput({ name, columns, pipeId })

  let flow
  if (parsedPipeId) {
    flow = await user
      .withAccessibleFlows({ requiredRole: 'editor' })
      .findById(parsedPipeId)

    if (!flow) {
      throw new UserFacingError('Pipe not found')
    }
  }

  const databaseType = (await getLdFlagValue(
    DATABASE_TYPE_LD_FLAG_KEY,
    user.email,
    'ddb',
  )) as DatabaseType

  const tableOperations = getTableOperations(databaseType)

  const table = await TableMetadata.transaction(async (trx) => {
    const pendingTable = await user.$relatedQuery('tables', trx).insertGraph({
      name: tableName,
      role: 'owner',
      db: databaseType,
      config: traceId ? createTileAiBuilderConfig(traceId) : {},
      columns: columnNames.map((columnName, position) => ({
        name: columnName,
        position,
      })),
    })

    await tableOperations.createTable(
      pendingTable.id,
      pendingTable.columns.map((column) => column.id),
    )

    return pendingTable
  })

  if (flow) {
    await addFlowTableConnection({
      flowId: flow.id,
      tableId: table.id,
      addedBy: user.id,
      flowOwnerId: flow.userId,
    })
  }

  const created = await TableMetadata.query()
    .findById(table.id)
    .withGraphFetched('columns')
    .throwIfNotFound()

  return {
    id: created.id,
    name: created.name,
    columns: created.columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
    })),
  }
}
