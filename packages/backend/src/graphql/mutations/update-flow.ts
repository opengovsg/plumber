import Context from '@/types/express/context'

type Params = {
  input: {
    id: string
    name: string
  }
}

const updateFlow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .findOne({
      id: params.input.id,
    })
    .throwIfNotFound()

  return await flow.$query().patchAndFetch({
    name: params.input.name,
  })
}

export default updateFlow
