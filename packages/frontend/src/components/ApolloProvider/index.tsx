import * as React from 'react'
import { ApolloProvider as BaseApolloProvider } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import { createClient } from '@/graphql/client'

type ApolloProviderProps = {
  children: React.ReactNode
}

const ApolloProvider = (props: ApolloProviderProps): React.ReactElement => {
  const toast = useToast()

  const onError = React.useCallback(
    (message: string) => {
      // HACKFIX: we use this toast.isActive to prevent duplicate toasts from being shown.
      // there should be a better way to handle this from the ApolloClient.
      const id = `graphql-error-${message.slice(0, 15)}`
      if (!toast.isActive(id)) {
        toast({
          id,
          title: message,
          description:
            'If this error persists, contact us at support@plumber.gov.sg.',
          status: 'error',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      }
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
