import type { ITableColumnConfig, ITableConfig } from '@plumber/types'
import type { Transaction } from 'objection'

import TableMetadata from '@/models/table-metadata'
import { getTableOperations } from '@/models/tiles/factory'
import type User from '@/models/user'

export interface CreateTileColumn {
  name: string
  position: number
  config?: ITableColumnConfig
}

export async function createTileInTransaction(
  trx: Transaction,
  {
    user,
    name,
    columns,
    config,
  }: {
    user: User
    name: string
    columns: CreateTileColumn[]
    config?: ITableConfig
  },
): Promise<TableMetadata> {
  const table = await user.$relatedQuery('tables', trx).insertGraph({
    name,
    role: 'owner',
    db: 'pg',
    ...(config && { config }),
    columns,
  })

  // createTable uses the tiles database, not trx. A throw rolls the metadata
  // back. DDL that already committed on the tiles database stays.
  await getTableOperations('pg').createTable(
    table.id,
    table.columns.map((column) => column.id),
  )

  return table
}
