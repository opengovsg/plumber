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
  // update last accessed at for collaborator/table
  await table.$relatedQuery('collaborators').patch({
    lastAccessedAt: new Date().toISOString(),
  })
  const columnIds = table.columns.map((column) => column.id)
  return getTableRows({ tableId, columnIds })
}

export default getAllRows
