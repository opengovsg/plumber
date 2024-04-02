import { createTableRows } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    name: string
    isBlank: boolean
  }
}

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

const createTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { name: tableName, isBlank: isBlankTable } = params.input
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
