import { SetRequired } from 'type-fest'

import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

type Params = {
  input: {
    tableId: string
  }
}

const getTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<SetRequired<TableMetadata, 'columns'>> => {
  const { tableId } = params.input
  const table = await context.currentUser
    .$relatedQuery('tables')
    .withGraphJoined('columns')
    .findById(tableId)
    .throwIfNotFound()

  return table
}

export default getTable
