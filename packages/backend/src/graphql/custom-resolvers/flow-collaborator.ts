import type { Resolvers } from '../__generated__/types.generated'

type FlowCollaboratorResolver = Resolvers['FlowCollaborator']

const email: FlowCollaboratorResolver['email'] = async (parent) => {
  // user is eagerly loaded in queries, we should use the loaded relation first
  if (parent?.user?.email) {
    return parent?.user?.email
  }

  // edge case: fallback to query if user relation is not loaded
  const user = await parent
    .$relatedQuery('user')
    .select('email')
    .throwIfNotFound()
  return user.email
}

export default {
  email,
} satisfies FlowCollaboratorResolver
