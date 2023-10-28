import { UpdateRowInput, updateTableRow } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: UpdateRowInput
}

const updateRow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { tableId, rowId, data } = params.input

  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  if (!(await table.validateRowKeys(data))) {
    throw new Error('Invalid column id')
  }

  await updateTableRow({ tableId, rowId, data })

  return rowId
}

export default updateRow
