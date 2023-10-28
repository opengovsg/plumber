import { CreateRowInput, createTableRow } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: CreateRowInput
}

const createRow = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<string> => {
  const { tableId, data } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRowKeys(data))) {
    throw new Error('Invalid column id')
  }

  const row = await createTableRow({ tableId, data })

  return row.rowId
}

export default createRow
