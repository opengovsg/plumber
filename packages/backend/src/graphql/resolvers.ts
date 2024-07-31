import type { Resolvers } from './__generated__/types.generated'
import adminQueryResolvers from './admin/queries'
import customResolvers from './custom-resolvers'
import mutationResolvers from './mutation-resolvers'
import queryResolvers from './query-resolvers'

export default {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  AdminQuery: adminQueryResolvers,
  ...customResolvers,
} satisfies Resolvers
