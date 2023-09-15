import Context from '@/types/express/context'

type Params = {
  input: {
    triggerAppKey: string
    connectionId: string
  }
}

const createFlow = async (
  _parent: unknown,
  params: Params,
  context: Context,
) => {
  const connectionId = params?.input?.connectionId
  const appKey = params?.input?.triggerAppKey

  const flow = await context.currentUser.$relatedQuery('flows').insert({
    name: 'Name your pipe',
  })

  if (connectionId) {
    await context.currentUser
      .$relatedQuery('connections')
      .findById(connectionId)
      .throwIfNotFound()
  }

  await flow.$relatedQuery('steps').insert([
    {
      type: 'trigger',
      position: 1,
      appKey,
      connectionId,
    },
    {
      type: 'action',
      position: 2,
    },
  ])

  return flow
}

export default createFlow
