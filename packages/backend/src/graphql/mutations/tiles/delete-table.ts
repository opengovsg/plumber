import TableColumnMetadata from '@/models/table-column-metadata'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const deleteFlow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  await TableColumnMetadata.query().delete().where('table_id', table.id)
  await table.$query().delete()

  return true
}

export default deleteFlow
