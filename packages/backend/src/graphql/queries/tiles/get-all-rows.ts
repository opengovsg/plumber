import { getAllTableRows, TableRowSchema } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  input: {
    tableId: string
  }
}

const getAllRows = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<Pick<TableRowSchema, 'rowId' | 'data'>[]> => {
  const { tableId } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findById(tableId)
    .throwIfNotFound()

  const rawRows = await getAllTableRows({ tableId })

  return table.stripInvalidKeys(rawRows)
}

export default getAllRows
