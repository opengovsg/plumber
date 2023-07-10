import { IUser } from '@plumber/types'

import { createContext, useState } from 'react'
import { FetchResult, useMutation, useQuery } from '@apollo/client'
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
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null)

  const { loading: fetchingCurrentUser } = useQuery<{
    getCurrentUser: CurrentUser
  }>(GET_CURRENT_USER, {
    fetchPolicy: 'no-cache',
    onCompleted: (data) => {
      setCurrentUser(data.getCurrentUser ?? null)
    },
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
        currentUser,
        logout,
      }}
    >
      {children}
    </AuthenticationContext.Provider>
  )
}
