import { getTableRows, TableRowItem } from '@/models/dynamodb/table-row'
import Context from '@/types/express/context'

type Params = {
  tableId: string
}

const getAllRows = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<Pick<TableRowItem, 'rowId' | 'data'>[]> => {
  const { tableId } = params
  const table = await context.currentUser
    .$relatedQuery('tables')
    .withGraphJoined('columns')
    .findById(tableId)
    .throwIfNotFound()
  await table.$query().patch({ accessedAt: new Date() })
  const columnIds = table.columns.map((column) => column.id)
  return getTableRows({ tableId, columnIds })
}

export default getAllRows
