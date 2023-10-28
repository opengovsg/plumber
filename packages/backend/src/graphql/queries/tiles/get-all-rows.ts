import { getAllTableRows, TableRowSchema } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  tableId: string
}

const getAllRows = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<Pick<TableRowSchema, 'rowId' | 'data'>[]> => {
  const { tableId } = params
  const table = await context.currentUser
    .$relatedQuery('tables')
    .withGraphJoined('columns')
    .findById(tableId)
    .throwIfNotFound()
    .debug()

  const rawRows = await getAllTableRows({ tableId })

  return table.stripInvalidKeys(rawRows)
}

export default getAllRows
