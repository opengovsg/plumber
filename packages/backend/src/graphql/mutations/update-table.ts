import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    name?: string
    addedColumns?: {
      name: string
    }[]
    modifiedColumns?: {
      id: string
      name: string
    }[]
    deletedColumns?: {
      id: string
    }[]
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

  const updatedFlow = await table.$query().patchAndFetch({
    name: tableName,
  })

  if (addedColumns) {
    await Promise.all(
      addedColumns.map(async (column) => {
        await table.$relatedQuery('columns').insert({
          name: column.name,
        })
      }),
    )
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
    await Promise.all(
      deletedColumns.map(async (column) => {
        await table.$relatedQuery('columns').deleteById(column.id)
      }),
    )
  }

  return updatedFlow
}

export default updateTable
