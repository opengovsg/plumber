import { tilesClient } from '@/config/tiles-database'

export function createTable(tableId: string, columnIds: string[]) {
  return tilesClient.schema.createTable(tableId, (table) => {
    table.string('rowId').primary()
    columnIds.forEach((columnId) => {
      table.text(columnId)
    })
    table.timestamps(true, true, true)
  })
}
