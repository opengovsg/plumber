import { deleteTableRow } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    tableId: string
    rowId: string
  }
}

const deleteRow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { tableId, rowId } = params.input

  await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  await deleteTableRow({ tableId, rowId })

  return true
}

export default deleteRow
