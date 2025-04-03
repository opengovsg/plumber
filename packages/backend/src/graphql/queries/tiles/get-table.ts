import { NotFoundError as ObjectionNotFoundError } from 'objection'

import { NotFoundError } from '@/errors/graphql-errors/not-found'
import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import logger from '@/helpers/logger'
import TableMetadata from '@/models/table-metadata'

import type { QueryResolvers } from '../../__generated__/types.generated'

const getTable: QueryResolvers['getTable'] = async (
  _parent,
  params,
  context,
) => {
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
    logger.error(e)
    if (e instanceof ObjectionNotFoundError) {
      if (context.tilesViewKey) {
        throw new InvalidTileViewKeyError(tableId, context.tilesViewKey)
      }
      throw new NotFoundError('Table does not exist or you do not have access.')
    }
    throw new Error('Error fetching table')
  }
}

export default getTable
