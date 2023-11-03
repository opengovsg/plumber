import { IUser } from '@plumber/types'

import { createContext } from 'react'
import { type FetchResult, useMutation, useQuery } from '@apollo/client'
import { Center, Spinner } from '@chakra-ui/react'
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

  const [logout] = useMutation(LOGOUT, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
  })

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
        currentUser: data?.getCurrentUser ?? null,
        logout,
      }}
    >
      {children}
    </AuthenticationContext.Provider>
  )
}
