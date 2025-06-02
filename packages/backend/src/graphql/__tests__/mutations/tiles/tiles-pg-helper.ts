import { tilesClient } from '@/config/tiles-database'

export async function checkIfTableExists(tableId: string) {
  return tilesClient.schema.hasTable(tableId)
}

export async function checkIfTableHasColumn(
  tableId: string,
  columnName: string,
) {
  return tilesClient.schema.hasColumn(tableId, columnName)
}
