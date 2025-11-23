import type { Resolvers } from '../__generated__/types.generated'

type FlowCollaboratorResolver = Resolvers['FlowCollaborator']

const email: FlowCollaboratorResolver['email'] = async (parent) => {
  // user is eagerly loaded in queries, we should use the loaded relation first
  if (parent?.user?.email) {
    return parent?.user?.email
  }

  /** edge case: fallback to query if user relation is not loaded
   * * this may be used when the user relation is not loaded in the FlowCollaborator
   *   object that is manually created in the flow custom resolver
   * * queries that fetch the FlowCollaborator object but do not fetch the user relation
   *   will not explicitly load the user relation
   */
  const user = await parent
    .$relatedQuery('user')
    .select('email')
    .throwIfNotFound()
  return user.email
}

export default {
  email,
} satisfies FlowCollaboratorResolver
