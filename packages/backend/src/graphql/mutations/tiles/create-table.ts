import { createTableRows } from '@/models/dynamodb/table-row'

import type { MutationResolvers } from '../../__generated__/types.generated'

const createTable: NonNullable<MutationResolvers['createTable']> = async (
  _parent,
  params,
  context,
) => {
  const tableName = params.input.name

  const table = await context.currentUser.$relatedQuery('tables').insertGraph({
    name: tableName,
    role: 'owner',
    columns: [
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
    ],
  })

  const emptyDataArray = new Array(5).fill({})

  await createTableRows({ tableId: table.id, dataArray: emptyDataArray })

  return table
}

export default createTable
