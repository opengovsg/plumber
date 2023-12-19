import { ITableColumnConfig } from '@plumber/types'

import pLimit from 'p-limit'

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
      config?: ITableColumnConfig
    }[]
    deletedColumns?: string[]
  }
}

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
  } = params.input

  const table = await context.currentUser
    .$relatedQuery('tables')
    .findOne({
      id: tableId,
    })
    .throwIfNotFound()

  if (tableName !== null) {
    if (!tableName.trim().length || tableName.trim().length > 64) {
      throw new Error('Invalid table name')
    }
    await table.$query().patch({
      name: tableName.trim(),
    })
  }

  if (addedColumns?.length) {
    if (addedColumns.some((name) => !name.trim().length)) {
      throw new Error('Invalid column name')
    }
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
          if (rest.name != null && !rest.name.trim().length) {
            throw new Error('Invalid column name')
          }
          if (rest.config?.width != null && rest.config.width < 1) {
            throw new Error('Invalid column width')
          }
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
    await table
      .$relatedQuery('columns')
      .hardDelete()
      .whereIn('id', deletedColumns)
  }

  const updatedTable = await table.$fetchGraph('columns')

  return updatedTable
}

export default updateTable
