import { DeleteRowInput, deleteTableRows } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: DeleteRowInput
}

const deleteRows = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const { tableId, rowIds } = params.input

  await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  await deleteTableRows({ tableId, rowIds })

  return rowIds
}

export default deleteRows
