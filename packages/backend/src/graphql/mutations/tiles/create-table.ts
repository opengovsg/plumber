import { getTableOperations } from '@/models/tiles/factory'

import type { MutationResolvers } from '../../__generated__/types.generated'

const PLACEHOLDER_COLUMNS = [
  {
    name: 'Column 1',
    position: 0,
  },
  {
    name: 'Column 2',
    position: 1,
  },
  {
    name: 'Column 3',
    position: 2,
  },
]
const PLACEHOLDER_ROWS = new Array(5).fill({})

const createTable: MutationResolvers['createTable'] = async (
  _parent,
  params,
  context,
) => {
  const {
    name: tableName,
    isBlank: isBlankTable,
    databaseType = 'pg',
  } = params.input

  if (!tableName) {
    throw new Error('Table name is required')
  }

  const tableOperations = getTableOperations(databaseType)

  // TODO: should i wrap this in a transaction?
  const table = await context.currentUser.$relatedQuery('tables').insertGraph({
    name: tableName,
    role: 'owner',
    db: databaseType,
    columns: isBlankTable ? [] : PLACEHOLDER_COLUMNS,
  })

  await tableOperations.createTable(
    table.id,
    isBlankTable ? [] : table.columns.map((column) => column.id),
  )

  if (!isBlankTable) {
    await tableOperations.createTableRows({
      tableId: table.id,
      dataArray: PLACEHOLDER_ROWS,
    })
  }

  return table
}

export default createTable
