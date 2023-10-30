/* eslint-disable no-console */
import '@/config/orm'
import '@/config/dynamodb'

import { randomUUID } from 'crypto'
import { argv } from 'process'

import { TableRow } from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

const TABLE_ID = argv[2]
if (!TABLE_ID) {
  console.log(
    'Please provide a table ID e.g. npm run -w backend dynamodb:seed -- <YOUR_TABLE_ID>',
  )
  process.exit(1)
}

const ROW_COUNT = 1000

async function seedRows(tableId: string) {
  // delete existing rows
  const existingRows = await TableRow.query('tableId')
    .eq(tableId)
    .attributes(['rowId'])
    .all()
    .exec()
  let deleteBatch = []
  const batchDeletePromises = []
  for (let i = 0; i < existingRows.length; i++) {
    const row = existingRows[i]
    deleteBatch.push({ tableId, rowId: row.rowId })
    if (deleteBatch.length === 25 || i === existingRows.length - 1) {
      batchDeletePromises.push(TableRow.batchDelete(deleteBatch))
      deleteBatch = []
    }
  }
  await Promise.all(batchDeletePromises)
  console.log(`Deleted ${existingRows.length} dynamodb rows`)

  // seed new rows
  const columns = await TableColumnMetadata.query()
    .select('id')
    .where('table_id', tableId)

  const columnIds = columns.map((column) => column.id)

  let rows = []
  const batchPutPromises = []
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
      batchPutPromises.push(TableRow.batchPut(rows))
      rows = []
    }
  }
  await Promise.all(batchPutPromises)
}

seedRows(TABLE_ID).then(() => {
  console.log(`${ROW_COUNT} dynamodb rows seeded`)
  process.exit(0)
})
