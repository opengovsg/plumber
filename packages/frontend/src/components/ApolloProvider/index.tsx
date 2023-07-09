import * as React from 'react'
import { ApolloProvider as BaseApolloProvider } from '@apollo/client'
import { createClient } from 'graphql/client'
import { SnackbarMessage, useSnackbar } from 'notistack'

type ApolloProviderProps = {
  children: React.ReactNode
}

const ApolloProvider = (props: ApolloProviderProps): React.ReactElement => {
  const { enqueueSnackbar } = useSnackbar()

  const onError = React.useCallback(
    (message: SnackbarMessage) => {
      enqueueSnackbar(message, { variant: 'error' })
    },
    [enqueueSnackbar],
  )

  const client = React.useMemo(() => {
    return createClient({
      onError,
    })
  }, [onError])

  return <BaseApolloProvider client={client} {...props} />
}

export default ApolloProvider
