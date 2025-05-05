import { DataPropertyNames } from 'objection'
import pLimit from 'p-limit'

import { BadUserInputError } from '@/errors/graphql-errors'
import { castGsiValue, GSIS, TableRow } from '@/models/dynamodb/table-row'
import TableCollaborator from '@/models/table-collaborators'
import TableColumnMetadata from '@/models/table-column-metadata'

import type { AdminMutationResolvers } from '../../__generated__/types.generated'

const DEFAULT_PATCH_LIMIT = 1000

/**
 * This function patches the relevant column into the sort key for a given GSI
 *
 * @input
 * tableId: string - ID of table to patch
 * columnId: string - ID of column to patch from
 * limit: number - Maximum number of rows to patch
 * returnCount: boolean - Whether to return the number of rows left to patch
 * (this will usually be set to true for the first call)
 *
 * @output
 * numRowsPatched: number - Number of rows patched
 * numRowsLeftToPatch: number - Number of rows left to patch (only returned if returnCount is true)
 * hasMore: boolean - Whether there are more rows to patch
 */

const patchGsiRows: AdminMutationResolvers['patchGsiRows'] = async (
  _parent,
  params,
  context,
) => {
  const { tableId, columnId, limit: limitInput, returnCount } = params.input

  /**
   * Default limit is 1000
   */
  const limit = limitInput ?? DEFAULT_PATCH_LIMIT

  if (!tableId || !columnId || limit <= 0) {
    throw new BadUserInputError('Invalid input')
  }

  /**
   * Checks that the admin is access the table from an editor or above account
   */
  await TableCollaborator.hasAccess(context.currentUser.id, tableId, 'editor')

  /**
   * Gets the gsi config for the column to patch from
   */
  const { config } = await TableColumnMetadata.query()
    .findById(columnId)
    .throwIfNotFound()

  if (!config.gsi) {
    throw new BadUserInputError('Column does not have a GSI')
  }

  /**
   * GSI MUST be a valid GSI
   * status MUST be pending
   * patchFrom MUST be set
   */
  const correspondingGsi = GSIS.find((gsi) => gsi.gsi === config.gsi.indexName)
  if (
    config.gsi.status !== 'pending' ||
    !config.gsi.patchFrom ||
    !correspondingGsi
  ) {
    throw new BadUserInputError('GSI status is invalid or no patchFrom date')
  }

  /**
   * Gets the rows to patch in descending order of createdAt
   * Only rows before the patchFrom date are included
   */
  const { data: rowsToPatch, cursor } = await TableRow.query
    .byCreatedAt({
      tableId,
    })
    .lt({ createdAt: new Date(config.gsi.patchFrom).getTime() })
    .go({
      order: 'desc',
      limit,
      ignoreOwnership: true,
    })

  /**
   * We update with a concurrency of 10 to prevent overloading the partition
   * and server
   */
  const updateLimit = pLimit(10)

  await Promise.all(
    /**
     * For each row, we update the GSI sort key with the value of the column
     * to patch from
     */
    rowsToPatch.map(async (item) => {
      await updateLimit(async () => {
        /**
         * 1. Read original value of column to patch from
         * 2. Cast the original value to a string (since our sort key is a string for now)
         * 3. Update the GSI sort key with the casted value
         * PS: Since this is not an atomic operation, we need to ensure that
         * the original value is still the same when we update the GSI sort key
         * If not, this throws an error and the whole batch has to be re-run
         */
        const row = await TableRow.get({
          tableId,
          rowId: item.rowId,
        }).go({
          ignoreOwnership: true,
        })
        if (!row) {
          throw new Error('Row not found')
        }

        const originalValue = row.data.data[columnId]
        const valueToPatch = castGsiValue(originalValue)

        return TableRow.update({ tableId, rowId: item.rowId })
          .data((row, { set, remove }) => {
            /**
             * If undefined/nullish or empty string, remove the sort key
             * Otherwise, set the sort key to the value to patch
             */
            if (valueToPatch != null) {
              set(row[correspondingGsi.sk], valueToPatch)
            } else {
              remove(row[correspondingGsi.sk])
            }
          })
          .where(({ data }, { eq }) => eq(data[columnId], originalValue))
          .go({
            ignoreOwnership: true,
          })
      })
    }),
  )

  const hasMore = rowsToPatch.length === 0 || !!cursor

  /**
   * We get the last(earliest) createdAt of the rows to patch
   * This will be used to update the patchFrom date
   */
  const lastPatchedCreatedAt = rowsToPatch[rowsToPatch.length - 1].createdAt

  await TableColumnMetadata.query()
    .patch({
      ['config:gsi' as DataPropertyNames<TableColumnMetadata>]: {
        ...config.gsi,
        status: hasMore ? 'pending' : 'ready',
        patchFrom: hasMore
          ? new Date(lastPatchedCreatedAt).toISOString()
          : undefined,
      },
    })
    .where({ id: columnId })

  /**
   * If returnCount is true, we get the number of rows left to patch
   */
  let numRowsLeftToPatch
  if (returnCount) {
    const numRowsLeftToPatchRes = await TableRow.query
      .byCreatedAt({
        tableId,
      })
      .lt({ createdAt: lastPatchedCreatedAt })
      .go({
        pages: 'all',
        attributes: ['rowId'],
      })
    numRowsLeftToPatch = numRowsLeftToPatchRes.data.length
  }

  return {
    numRowsPatched: rowsToPatch.length,
    numRowsLeftToPatch,
    hasMore,
  }
}

export default patchGsiRows
