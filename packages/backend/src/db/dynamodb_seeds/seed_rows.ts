/* eslint-disable no-console */
import '@/config/orm'
import '@/config/dynamodb'

import { randomUUID } from 'crypto'

import { TableRow } from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

const ROW_COUNT = 1000

async function seedRows(tableId: string) {
  // delete existing rows
  const existingRows = await TableRow.query('tableId')
    .eq(tableId)
    .attributes(['rowId'])
    .all()
    .exec()
  let deleteBatch = []
  for (const row of existingRows) {
    deleteBatch.push({ tableId, rowId: row.rowId })
    if (
      deleteBatch.length === 25 ||
      row === existingRows[existingRows.length - 1]
    ) {
      await TableRow.batchDelete(deleteBatch)
      deleteBatch = []
    }
  }

  const columns = await TableColumnMetadata.query()
    .select('id')
    .where('table_id', tableId)

  const columnIds = columns.map((column) => column.id)

  let rows = []
  for (let i = 0; i < ROW_COUNT; i++) {
    const row = {
      tableId,
      rowId: randomUUID(),
      data: {} as Record<string, string>,
    }
    for (const columnId of columnIds) {
      row.data[columnId] = `${i}_${columnId}`
    }
    rows.push(row)
    if (rows.length === 25 || i === ROW_COUNT - 1) {
      await TableRow.batchPut(rows)
      console.log(rows)
      rows = []
    }
  }
}

seedRows('f753aa42-6071-4260-be42-ca60cd9896be').then(() => {
  console.log(`${ROW_COUNT} dynamodb rows seeded`)
  process.exit(0)
})
