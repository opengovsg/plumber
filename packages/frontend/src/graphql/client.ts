import { ApolloClient } from '@apollo/client'

import cache from './cache'
import createLink from './link'

type CreateClientOptions = {
  onError?: (message: string) => void
  token?: string | null
}

const GRAPHQL_URL = '/graphql'

const client = new ApolloClient({
  cache,
  link: createLink({ uri: GRAPHQL_URL }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
})

export function createClient(options: CreateClientOptions): typeof client {
  const { onError, token } = options
  const link = createLink({ uri: GRAPHQL_URL, token, onError })

  client.setLink(link)

  return client
}

export default client
