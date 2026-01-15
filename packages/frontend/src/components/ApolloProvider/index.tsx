import { useCallback, useMemo } from 'react'
import { ApolloProvider as BaseApolloProvider } from '@apollo/client'
import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox, useToast } from '@opengovsg/design-system-react'

import { NOT_AUTHORISED } from '@/config/errors'
import * as URLS from '@/config/urls'
import { createClient } from '@/graphql/client'

type ApolloProviderProps = {
  children: React.ReactNode
}

const SessionExpiredToast = () => {
  return (
    <Infobox
      alignItems="center"
      variant="warning"
      justifyContent="space-between"
      borderRadius="md"
      border="1px solid"
      w="500px"
      maxW="90vw"
      borderColor="interaction.warning.default"
      style={{
        padding: '0.5rem 1rem',
      }}
    >
      <Flex w="100%" justifyContent="space-between" alignItems="center">
        <Text>Session expired. Please login again.</Text>
        <Button
          colorScheme="yellow"
          variant="outline"
          size="sm"
          onClick={() => {
            const redirectQueryParam =
              window.location.pathname + window.location.search
            window.location.href = URLS.ADD_REDIRECT_TO_LOGIN(
              encodeURIComponent(redirectQueryParam),
            )
          }}
        >
          Login
        </Button>
      </Flex>
    </Infobox>
  )
}

const ApolloProvider = (props: ApolloProviderProps): React.ReactElement => {
  const toast = useToast()

  const showSessionExpiredToast = useCallback(
    (id: string) => {
      toast({
        id,
        duration: null,
        isClosable: false,
        position: 'top',
        render: SessionExpiredToast,
      })
    },
    [toast],
  )

  const onError = useCallback(
    (message: string) => {
      // HACKFIX: we use this toast.isActive to prevent duplicate toasts from being shown.
      // there should be a better way to handle this from the ApolloClient.
      const id = `graphql-error-${message.slice(0, 15)}`
      if (!toast.isActive(id)) {
        if (message === NOT_AUTHORISED) {
          showSessionExpiredToast(id)
          return
        }
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
