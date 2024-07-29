import type { QueryResolvers } from '../__generated__/types.generated'

const UUID_REGEX = /^[a-z,0-9,-]{36,36}$/

const getFlow: QueryResolvers['getFlow'] = async (_parent, params, context) => {
  // To avoid the gibberish error code if a user keys in an invalid editor route e.g. editor/123
  if (!UUID_REGEX.test(params.id)) {
    throw new Error('The pipe id in your URL is of an invalid format.')
  }

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
