import { ApolloClient } from '@apollo/client'

import appConfig from '@/config/app'

import cache from './cache'
import createLink from './link'

type CreateClientOptions = {
  onError?: (message: string, title?: string) => void
  token?: string | null
}

export const GRAPHQL_URL = '/graphql'

const client = new ApolloClient({
  cache,
  link: createLink({ uri: GRAPHQL_URL }),
  connectToDevTools: appConfig.isDev,
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
