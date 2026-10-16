import { NotFoundError as ObjectionNotFoundError } from 'objection'

import { NotFoundError } from '@/errors/graphql-errors/not-found'
import InvalidTileViewKeyError from '@/errors/invalid-tile-view-key'
import InvalidTileViewTokenError from '@/errors/invalid-tile-view-password'
import logger from '@/helpers/logger'

import type { QueryResolvers } from '../../__generated__/types.generated'
import { fetchTableWithViewOnlyCheck } from './view-only.helper'

const getTable: QueryResolvers['getTable'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId } = params
  try {
    if (context.tilesViewKey) {
      const { table } = await fetchTableWithViewOnlyCheck({
        tableId,
        context,
        // columns are fetched later in the custom resolver
        withColumns: false,
      })

      return table
    }

    // Normal authenticated user flow
    const table = await context.currentUser
      .$relatedQuery('tables')
      .findById(tableId)
      .throwIfNotFound()
    return table
  } catch (e) {
    logger.error(e)
    if (e instanceof ObjectionNotFoundError) {
      throw new NotFoundError('Table does not exist or you do not have access.')
    }
    if (
      e instanceof InvalidTileViewTokenError ||
      e instanceof InvalidTileViewKeyError
    ) {
      throw e
    }
    throw new Error('Error fetching table')
  }
}

export default getTable
