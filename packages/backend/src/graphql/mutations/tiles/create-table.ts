import { createTableRows } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    name: string
  }
}

const createTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const tableName = params.input.name

  const table = await context.currentUser.$relatedQuery('tables').insert({
    name: tableName,
  })

  await table.$relatedQuery('columns').insert([
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
  ])

  const emptyDataArray = new Array(5).fill({})

  await createTableRows({ tableId: table.id, dataArray: emptyDataArray })

  return table
}

export default createTable
