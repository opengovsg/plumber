import { chunk } from 'lodash'

import { _batchCreate } from '@/models/tiles/dynamodb/table-row'
import { getTableOperations } from '@/models/tiles/factory'
import { DatabaseType } from '@/models/tiles/types'

import { generateMockTableRowData } from '../../mutations/tiles/table.mock'

export async function insertMockTableRows(
  tableId: string,
  numRowsToInsert: number,
  columnIds: string[],
  databaseType: DatabaseType,
): Promise<string[]> {
  const rows = []
  for (let i = 0; i < numRowsToInsert; i++) {
    rows.push(generateMockTableRowData({ columnIds }))
  }

  const tableOperations = getTableOperations(databaseType)
  const chunks = chunk(rows, 100)
  for (const dataArray of chunks) {
    await tableOperations.createTableRows({
      tableId,
      dataArray,
    })
  }

  return rows.map((r) => r.rowId)
}
