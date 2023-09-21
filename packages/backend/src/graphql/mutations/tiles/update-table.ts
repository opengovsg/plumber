import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    name?: string
    addedColumns?: string[]
    modifiedColumns?: {
      id: string
      name: string
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
    await table
      .$relatedQuery('columns')
      .insert(addedColumns.map((name) => ({ name })))
  }

  if (modifiedColumns?.length) {
    await Promise.all(
      modifiedColumns.map(async (column) => {
        await table
          .$relatedQuery('columns')
          .patchAndFetchById(column.id, {
            name: column.name,
          })
          .throwIfNotFound()
      }),
    )
  }

  if (deletedColumns?.length) {
    await table.$relatedQuery('columns').delete().whereIn('id', deletedColumns)
  }

  const updatedTable = await table.$fetchGraph('columns')

  return updatedTable
}

export default updateTable
