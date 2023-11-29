/* eslint-disable no-console */
import '@/config/orm'
import '@/config/dynamodb'

import { argv } from 'process'

import {
  createTableRows,
  deleteTableRows,
  getAllTableRows,
  getTableRowCount,
} from '@/models/dynamodb/table-row'
import TableColumnMetadata from '@/models/table-column-metadata'

const TABLE_ID = argv[2]
if (!TABLE_ID) {
  console.log(
    'Please provide a table ID e.g. npm run -w backend dynamodb:seed -- <YOUR_TABLE_ID>',
  )
  process.exit(1)
}

const COUNT_ONLY = argv[3]

const ROW_COUNT = 10000
async function seedRows(tableId: string) {
  // delete existing rows
  const existingRows = await getAllTableRows({ tableId })
  console.log('count', existingRows.length)

  if (COUNT_ONLY === 'count') {
    return
  }

  const rowIdsToDelete = existingRows.map((row) => row.rowId)

  console.time('deleteTableRows')
  await deleteTableRows({
    tableId,
    rowIds: rowIdsToDelete,
  })
  console.timeEnd('deleteTableRows')

  const newCount = await getTableRowCount({ tableId })
  console.log('new count', newCount)
  console.log(`Deleted ${existingRows.length - newCount} dynamodb rows`)

  // seed new rows
  const columns = await TableColumnMetadata.query()
    .select('id')
    .where('table_id', tableId)

  const columnIds = columns.map((column) => column.id)

  const dataArray = []
  // rows added sequentially to preserve row order
  for (let i = 0; i < ROW_COUNT; i++) {
    const data = {} as Record<string, string>
    for (const columnId of columnIds) {
      data[columnId] = `${i}_${columnId}`
    }
    dataArray.push(data)
  }
  console.time('createTableRows')
  await createTableRows({ tableId, dataArray })
  console.timeEnd('createTableRows')

  const addedCount = await getTableRowCount({ tableId })
  console.log(`${addedCount} dynamodb rows seeded`)
}

seedRows(TABLE_ID).then(() => {
  process.exit(0)
})
