import TableMetadata from '@/models/table-metadata'
import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
  }
}

const deleteTable = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  await TableMetadata.transaction(async (trx) => {
    const table = await context.currentUser
      .$relatedQuery('tables', trx)
      .findOne({
        id: params.input.id,
      })
      .throwIfNotFound()

    await table.$relatedQuery('columns', trx).delete()
    await table.$query(trx).delete()
  })

  return true
}

export default deleteTable
