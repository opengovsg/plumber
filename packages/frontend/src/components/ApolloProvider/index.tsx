import * as React from 'react'
import { ApolloProvider as BaseApolloProvider } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'
import { createClient } from 'graphql/client'

type ApolloProviderProps = {
  children: React.ReactNode
}

const ApolloProvider = (props: ApolloProviderProps): React.ReactElement => {
  const toast = useToast()

  const onError = React.useCallback(
    (message: string) => {
      toast({
        title: message,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
      })
    },
    [toast],
  )

  const client = React.useMemo(() => {
    return createClient({
      onError,
    })
  }, [onError])

  return <BaseApolloProvider client={client} {...props} />
}

export default ApolloProvider
