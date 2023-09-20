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

  if (addedColumns) {
    await table
      .$relatedQuery('columns')
      .insert(addedColumns.map((name) => ({ name })))
  }

  if (modifiedColumns) {
    await Promise.all(
      modifiedColumns.map(async (column) => {
        await table.$relatedQuery('columns').patchAndFetchById(column.id, {
          name: column.name,
        })
      }),
    )
  }

  if (deletedColumns) {
    await table.$relatedQuery('columns').delete().whereIn('id', deletedColumns)
  }

  const updateTable = await table
    .$query()
    .patchAndFetch({
      name: tableName,
    })
    .withGraphFetched('columns')

  return updateTable
}

export default updateTable
