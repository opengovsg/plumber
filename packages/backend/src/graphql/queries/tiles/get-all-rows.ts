import { NotFoundError as ObjectionNotFoundError } from 'objection'

import { NotFoundError } from '@/errors/graphql-errors/not-found'
import { RateLimitedError } from '@/errors/graphql-errors/rate-limited'
import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import logger from '@/helpers/logger'
import TableMetadata from '@/models/table-metadata'
import { DYNAMODB_THROUGHPUT_EXCEEDED_ERROR_MESSAGE } from '@/models/tiles/dynamodb/helpers'
import { getTableOperations } from '@/models/tiles/factory'

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

    const tableOperations = getTableOperations(table.db)

    const columnIds = table.columns.map((column) => column.id)

    const { rows, stringifiedCursor: newStringifiedCursor } =
      await tableOperations.getTableRows({
        tableId,
        columnIds,
        // If table is postgres, we set pagination limit
        // If table is dynamodb, the pagination size is based on dynamodb query limits
        scanLimit: table.db === 'pg' ? 10000 : undefined,
        stringifiedCursor:
          table.db === 'ddb' && !stringifiedCursor
            ? 'start'
            : stringifiedCursor,
      })

    // Convert data object to csv to minimize payload size
    rows.forEach((row) => {
      row.data = JSON.stringify(columnIds.map((columnId) => row.data[columnId]))
    })

    return {
      rows,
      columnIds,
      stringifiedCursor: newStringifiedCursor,
    }
  } catch (e) {
    logger.error(e)
    if (e instanceof ObjectionNotFoundError) {
      if (context.tilesViewKey) {
        throw new InvalidTileViewKeyError(tableId, context.tilesViewKey)
      }
      throw new NotFoundError('Table does not exist or you do not have access.')
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
