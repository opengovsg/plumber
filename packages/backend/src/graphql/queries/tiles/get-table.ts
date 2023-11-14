import { NotFoundError } from 'objection'
import { SetRequired } from 'type-fest'

import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

type Params = {
  tableId: string
}

const getTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<SetRequired<TableMetadata, 'columns'>> => {
  const { tableId } = params

  try {
    const table = await context.currentUser
      .$relatedQuery('tables')
      .withGraphJoined('columns')
      .findById(tableId)
      .orderBy('columns.position', 'asc')
      .throwIfNotFound()

    return table
  } catch (e) {
    if (e instanceof NotFoundError) {
      throw new Error('Table not found')
    }
    throw new Error('Error fetching table')
  }
}

export default getTable
