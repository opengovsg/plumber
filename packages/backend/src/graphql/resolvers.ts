import type { Resolvers } from './__generated__/types.generated'
import adminMutationResolvers from './admin/mutations'
import adminQueryResolvers from './admin/queries'
import customResolvers from './custom-resolvers'
import mutationResolvers from './mutation-resolvers'
import queryResolvers from './query-resolvers'

export default {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  AdminQuery: adminQueryResolvers,
  AdminMutation: adminMutationResolvers,
  ...customResolvers,
} satisfies Resolvers
