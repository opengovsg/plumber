import type { QueryResolvers } from '../__generated__/types.generated'

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  const flow = await context.currentUser
    .$relatedQuery('flows')
    .withGraphFetched({
      pendingTransfer: {
        newOwner: true,
      },
    })
    .withGraphJoined('[steps.[connection]]')
    .orderBy('steps.position', 'asc')
    .findOne({ 'flows.id': params.id })
    .throwIfNotFound()

  return flow
}

export default getFlow
