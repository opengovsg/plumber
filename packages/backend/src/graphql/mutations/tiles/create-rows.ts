import { CreateRowsInput, createTableRows } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: CreateRowsInput
}

const createRows = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<boolean> => {
  const { tableId, dataArray } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRows(dataArray))) {
    throw new Error('Invalid column id')
  }

  await createTableRows({ tableId, dataArray })

  return true
}

export default createRows
