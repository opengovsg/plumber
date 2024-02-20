import { NotFoundError } from 'objection'

import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

type Params = {
  tableId: string
}

const getTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
): Promise<TableMetadata> => {
  const { tableId } = params

  try {
    const table = context.tilesViewKey
      ? await TableMetadata.query()
          .findOne({
            id: tableId,
            view_only_key: context.tilesViewKey,
          })
          .throwIfNotFound()
      : await context.currentUser
          .$relatedQuery('tables')
          .findById(tableId)
          .throwIfNotFound()

    return table
  } catch (e) {
    if (e instanceof NotFoundError) {
      if (context.tilesViewKey) {
        throw new InvalidTileViewKeyError(tableId, context.tilesViewKey)
      }
      throw new Error('Table not found')
    }
    throw new Error('Error fetching table')
  }
}

export default getTable
