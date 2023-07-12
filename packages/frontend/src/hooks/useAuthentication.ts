import { useContext } from 'react'
import type { AuthenticationContextParams } from 'contexts/Authentication'
import { AuthenticationContext } from 'contexts/Authentication'

export default function useAuthentication(): AuthenticationContextParams {
  return useContext(AuthenticationContext)
}
