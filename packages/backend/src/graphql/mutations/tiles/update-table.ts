import { ITableColumnConfig } from '@plumber/types'

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

  if (tableName?.length) {
    await table.$query().patch({
      name: tableName,
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
    await TableColumnMetadata.transaction(async (trx) => {
      await Promise.all(
        modifiedColumns.map(async (column) => {
          const { id, ...rest } = column
          if (rest.name != null && !rest.name.trim().length) {
            throw new Error('Invalid column name')
          }
          if (rest.config?.width != null && rest.config.width < 1) {
            throw new Error('Invalid column width')
          }
          await table
            .$relatedQuery('columns', trx)
            .patchAndFetchById(id, rest)
            .throwIfNotFound()
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
