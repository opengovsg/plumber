import * as React from 'react'
import type { AuthenticationContextParams } from 'contexts/Authentication'
import { AuthenticationContext } from 'contexts/Authentication'
import { isJwtExpired } from 'helpers/jwt'

type UseAuthenticationReturn = {
  isAuthenticated: boolean
  token: AuthenticationContextParams['token']
  updateToken: AuthenticationContextParams['updateToken']
}

export default function useAuthentication(): UseAuthenticationReturn {
  const authenticationContext = React.useContext(AuthenticationContext)

  const isAuthenticated =
    !!authenticationContext.token && !isJwtExpired(authenticationContext.token)

  return {
    token: authenticationContext.token,
    updateToken: authenticationContext.updateToken,
    isAuthenticated,
  }
}
