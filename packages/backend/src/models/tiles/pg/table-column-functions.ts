import { tilesClient } from '@/config/tiles-database'

export async function createTableColumns(tableId: string, columnIds: string[]) {
  return tilesClient.transaction(async (trx) =>
    trx.schema.alterTable(tableId, (table) => {
      columnIds.forEach((columnId) => {
        table.text(columnId)
      })
    }),
  )
}

export async function deleteTableColumns(tableId: string, columnIds: string[]) {
  return tilesClient.transaction(async (trx) =>
    trx.schema.alterTable(tableId, (table) => {
      columnIds.forEach((columnId) => {
        table.dropColumn(columnId)
      })
    }),
  )
}
