import { IUser } from '@plumber/types'

import { createContext, useEffect } from 'react'
import { FetchResult, useMutation, useQuery } from '@apollo/client'
import { Center, Spinner } from '@chakra-ui/react'
import { datadogRum } from '@datadog/browser-rum'
import { LOGOUT } from 'graphql/mutations/logout'
import { GET_CURRENT_USER } from 'graphql/queries/get-current-user'

type CurrentUser = Pick<IUser, 'id' | 'email'> | null

export type AuthenticationContextParams = {
  currentUser: CurrentUser
  logout: () => Promise<FetchResult<void>>
}

export const AuthenticationContext = createContext(
  {} as AuthenticationContextParams,
)

type AuthenticationProviderProps = {
  children: React.ReactNode
}

export const AuthenticationProvider = ({
  children,
}: AuthenticationProviderProps) => {
  const { data, loading: fetchingCurrentUser } = useQuery<{
    getCurrentUser: CurrentUser
  }>(GET_CURRENT_USER, {
    fetchPolicy: 'no-cache',
  })
  const currentUser = data?.getCurrentUser
  const [logout] = useMutation(LOGOUT, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
  })
  useEffect(() => {
    if (currentUser) {
      datadogRum.setUser(currentUser)
    }
  }, [currentUser])

  if (fetchingCurrentUser) {
    return (
      <Center height="100vh">
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      </Center>
    )
  }

  return (
    <AuthenticationContext.Provider
      value={{
        currentUser: currentUser ?? null,
        logout,
      }}
    >
      {children}
    </AuthenticationContext.Provider>
  )
}
