import type { MutationResolvers } from '../__generated__/types.generated'

const createFlow: MutationResolvers['createFlow'] = async (
  _parent,
  params,
  context,
) => {
  // TODO: remove connection id and app key in the next PR
  const connectionId = params?.input?.connectionId
  const appKey = params?.input?.triggerAppKey
  const flowName = params?.input?.flowName ?? 'Name your pipe'

  const flow = await context.currentUser.$relatedQuery('flows').insert({
    name: flowName,
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
