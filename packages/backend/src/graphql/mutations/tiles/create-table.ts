import { createTableRows } from '@/models/dynamodb/table-row'

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
  const { name: tableName, isBlank: isBlankTable } = params.input

  if (!tableName) {
    throw new Error('Table name is required')
  }

  const table = await context.currentUser.$relatedQuery('tables').insertGraph({
    name: tableName,
    role: 'owner',
    columns: isBlankTable ? [] : PLACEHOLDER_COLUMNS,
  })

  if (!isBlankTable) {
    await createTableRows({ tableId: table.id, dataArray: PLACEHOLDER_ROWS })
  }

  return table
}

export default createTable
