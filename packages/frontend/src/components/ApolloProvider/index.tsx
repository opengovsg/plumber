import { useCallback, useMemo } from 'react'
import { ApolloProvider as BaseApolloProvider } from '@apollo/client'
import { Link } from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import { NOT_AUTHORISED } from '@/config/errors'
import { createClient } from '@/graphql/client'
import { useSessionExpiredToast } from '@/hooks/useSessionExpiredToast'

type ApolloProviderProps = {
  children: React.ReactNode
}

const ApolloProvider = (props: ApolloProviderProps): React.ReactElement => {
  const toast = useToast()
  const showSessionExpiredToast = useSessionExpiredToast()

  const onError = useCallback(
    (message: string) => {
      if (message === NOT_AUTHORISED) {
        showSessionExpiredToast()
        return
      }

      // HACKFIX: we use this toast.isActive to prevent duplicate toasts from being shown.
      // there should be a better way to handle this from the ApolloClient.
      const id = `graphql-error-${message.slice(0, 15)}`
      if (!toast.isActive(id)) {
        toast({
          id,
          title: message,
          description: (
            <>
              If this error persists, please visit our{' '}
              <Link href="https://go.gov.sg/plumber-support" isExternal>
                support form
              </Link>{' '}
              for help.
            </>
          ),
          status: 'error',
          duration: 3000,
          isClosable: true,
          position: 'top',
        })
      }
    },
    [showSessionExpiredToast, toast],
  )

  const client = useMemo(() => {
    return createClient({
      onError,
    })
  }, [onError])

  return <BaseApolloProvider client={client} {...props} />
}

export default ApolloProvider
