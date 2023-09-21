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
  const table = await context.currentUser
    .$relatedQuery('tables')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  await table.$relatedQuery('columns').delete()
  await table.$query().delete()

  return true
}

export default deleteTable
