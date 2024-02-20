import { ITableColumnConfig } from '@plumber/types'

import pLimit from 'p-limit'
import { z } from 'zod'

import TableColumnMetadata from '@/models/table-column-metadata'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    name?: string
    addedColumns?: string[]
    modifiedColumns?: {
      id: string
      name?: string
      position?: number
      config?: ITableColumnConfig
    }[]
    deletedColumns?: string[]
  }
}

export const updateTableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(64).optional(),
  addedColumns: z.array(z.string().trim().min(1).max(255)).optional(),
  modifiedColumns: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(255).optional(),
        position: z.number().int().min(0).optional(),
        config: z
          .object({
            width: z.number().int().min(1).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  deletedColumns: z.array(z.string().uuid()).optional(),
})

const updateTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const {
    id: tableId,
    name: tableName,
    addedColumns,
    modifiedColumns,
    deletedColumns,
  } = updateTableSchema.parse(params.input)

  const table = await context.currentUser
    .$relatedQuery('tables')
    .findOne({
      id: tableId,
    })
    .throwIfNotFound()

  if (tableName) {
    await table.$query().patch({
      name: tableName.trim(),
    })
  }

  if (addedColumns?.length) {
    await TableColumnMetadata.transaction(async (trx) => {
      const results = await table
        .$relatedQuery('columns', trx)
        .max('position as position') // aliasing for more convenient typing
      const maxPosition = results[0].position || 0
      await table.$relatedQuery('columns', trx).insert(
        addedColumns.map((name, i) => ({
          name,
          position: maxPosition + i + 1,
        })),
      )
    })
  }

  if (modifiedColumns?.length) {
    const limit = pLimit(5)
    await TableColumnMetadata.transaction(async (trx) => {
      // Ideally, we want to update multiple columns in a single query, but there's
      // no easy way to do that with objectionjs. So we'll just do it one by one.
      // But to prevent too many queries from being executed at the same time,
      // we're setting a concurrency limit of 5.
      await Promise.all(
        modifiedColumns.map(async (column) => {
          const { id, ...rest } = column
          return limit(() =>
            table
              .$relatedQuery('columns', trx)
              .patchAndFetchById(id, rest)
              .throwIfNotFound(),
          )
        }),
      )
    })
  }

  if (deletedColumns?.length) {
    await TableColumnMetadata.transaction(async (trx) => {
      const columns = await table.$relatedQuery('columns', trx)
      // There needs to be at least one column left
      if (columns.length <= deletedColumns.length) {
        throw new Error('Cannot delete all columns')
      }
      await table
        .$relatedQuery('columns')
        .delete()
        .whereIn('id', deletedColumns)
    })
  }

  const updatedTable = await table.$fetchGraph('columns')

  return updatedTable
}

export default updateTable
