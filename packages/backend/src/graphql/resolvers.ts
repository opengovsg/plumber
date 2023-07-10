import customResolvers from './custom-resolvers'
import mutationResolvers from './mutation-resolvers'
import queryResolvers from './query-resolvers'

const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  ...customResolvers,
}

export default resolvers
