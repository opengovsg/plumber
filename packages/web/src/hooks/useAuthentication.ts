import * as React from 'react'
import type { AuthenticationContextParams } from 'contexts/Authentication'
import { AuthenticationContext } from 'contexts/Authentication'

type UseAuthenticationReturn = {
  isAuthenticated: boolean
  token: AuthenticationContextParams['token']
  updateToken: AuthenticationContextParams['updateToken']
}

export default function useAuthentication(): UseAuthenticationReturn {
  const authenticationContext = React.useContext(AuthenticationContext)

  return {
    token: authenticationContext.token,
    updateToken: authenticationContext.updateToken,
    isAuthenticated: Boolean(authenticationContext.token),
  }
}
