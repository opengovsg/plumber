import { tilesClient } from '@/config/tiles-database'

export async function checkIfTableExists(tableId: string) {
  return tilesClient.schema.hasTable(tableId)
}
