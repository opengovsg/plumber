import { tilesClient } from '@/config/tiles-database'

export function createTableColumns(tableId: string, columnIds: string[]) {
  return tilesClient.schema.alterTable(tableId, (table) => {
    columnIds.forEach((columnId) => {
      table.text(columnId)
    })
  })
}

export function deleteTableColumns(tableId: string, columnIds: string[]) {
  return tilesClient.schema.alterTable(tableId, (table) => {
    columnIds.forEach((columnId) => {
      table.dropColumn(columnId)
    })
  })
}
