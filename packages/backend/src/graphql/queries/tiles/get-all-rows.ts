import { NotFoundError } from 'objection'

import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import logger from '@/helpers/logger'
import { DYNAMODB_THROUGHPUT_EXCEEDED_ERROR_MESSAGE } from '@/models/dynamodb/helpers'
import { getTableRows } from '@/models/dynamodb/table-row'
import TableMetadata from '@/models/table-metadata'

import type { QueryResolvers } from '../../__generated__/types.generated'

const getAllRows: QueryResolvers['getAllRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, stringifiedCursor } = params

  try {
    const table = context.tilesViewKey
      ? await TableMetadata.query()
          .withGraphFetched('columns')
          .findOne({
            id: tableId,
            view_only_key: context.tilesViewKey,
          })
          .throwIfNotFound()
      : await context.currentUser
          .$relatedQuery('tables')
          .withGraphFetched('columns')
          .findById(tableId)
          .throwIfNotFound()

    // update last accessed at for collaborator/table
    if (!context.tilesViewKey && !context.isAdminOperation) {
      await table.$relatedQuery('collaborators').patch({
        lastAccessedAt: new Date().toISOString(),
      })
    }

    const columnIds = table.columns.map((column) => column.id)

    return await getTableRows({
      tableId,
      columnIds,
      stringifiedCursor: stringifiedCursor ?? 'start',
    })
    // TODO: remove keys from rows to reduce payload size
  } catch (e) {
    logger.error(e)
    if (e instanceof NotFoundError) {
      if (context.tilesViewKey) {
        throw new InvalidTileViewKeyError(tableId, context.tilesViewKey)
      }
      throw new Error('Table not found')
    }
    if (e.message.includes(DYNAMODB_THROUGHPUT_EXCEEDED_ERROR_MESSAGE)) {
      throw new RateLimitedError(
        'Unable to fetch rows at the moment. Please retry in a bit.',
      )
    }
    throw new Error('Error fetching rows')
  }
}

export default getAllRows
