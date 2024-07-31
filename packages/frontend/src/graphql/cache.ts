import type { InMemoryCacheConfig } from '@apollo/client'
import { InMemoryCache } from '@apollo/client'

interface IRef {
  __ref: string
}

export const cacheConfig = {
  typePolicies: {
    App: {
      keyFields: ['key'],
    },
    Mutation: {
      mutationType: true,
      fields: {
        verifyConnection: {
          merge(existing, verifiedConnection, { readField, cache }) {
            const appKey = readField('key', verifiedConnection)
            const appCacheId = cache.identify({
              __typename: 'App',
              key: appKey,
            })

            cache.modify({
              id: appCacheId,
              fields: {
                connections: (existingConnections) => {
                  const existingConnectionIndex = existingConnections.findIndex(
                    (connection: IRef) => {
                      return connection.__ref === verifiedConnection.__ref
                    },
                  )
                  const connectionExists = existingConnectionIndex !== -1

                  // newly created and verified connection
                  if (!connectionExists) {
                    return [verifiedConnection, ...existingConnections]
                  }

                  return existingConnections
                },
              },
            })

            return verifiedConnection
          },
        },
      },
    },
  },
} satisfies InMemoryCacheConfig

const cache = new InMemoryCache(cacheConfig)

export default cache
