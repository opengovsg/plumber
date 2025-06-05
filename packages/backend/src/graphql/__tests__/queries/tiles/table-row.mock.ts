import { randomUUID } from 'crypto'

import { _batchCreate } from '@/models/tiles/dynamodb/table-row'

import { generateMockTableRowData } from '../../mutations/tiles/table.mock'

export async function insertMockTableRows(
  tableId: string,
  numRowsToInsert: number,
  columnIds: string[],
): Promise<string[]> {
  const rows = []
  for (let i = 0; i < numRowsToInsert; i++) {
    rows.push({
      tableId,
      // use ulid for new tiles
      rowId: randomUUID(),
      data: generateMockTableRowData({ columnIds }),
    })
  }

  await _batchCreate(rows)

  return rows.map((r) => r.rowId)
}
