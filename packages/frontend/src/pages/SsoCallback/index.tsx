import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import SsoLoadingScreen from '@/components/SsoLoadingScreen'
import { FORBIDDEN } from '@/config/errors'
import * as URLS from '@/config/urls'
import { LOGIN_WITH_SSO } from '@/graphql/mutations/login-with-sso'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'
import { clearPostLoginRedirect } from '@/helpers/post-login-redirect'

function safeIdpErrorDescription(description: string | null): string | null {
  if (!description) {
    return null
  }
  // Keep user-facing IdP text short and avoid echoing anything that looks like
  // a secret or token.
  if (
    description.length > 200 ||
    /token|secret|code|bearer|password/i.test(description)
  ) {
    return null
  }
  return description
}

export default function SsoCallback(): JSX.Element {
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const [hasFailed, setFailed] = useState<boolean>(false)
  const [isForbidden, setForbidden] = useState<boolean>(false)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [loginWithSso] = useMutation(LOGIN_WITH_SSO, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
    context: { autoSnackbar: false },
  })

  // Account for React strict mode.
  const alreadyProcessed = useRef(false)

  useEffect(() => {
    if (alreadyProcessed.current) {
      return
    }

    alreadyProcessed.current = true

    const idpError = searchParams.get('error')
    const idpErrorDescription = searchParams.get('error_description')

    // IMPORTANT: clear the stored redirect on failure only, so a failed SSO
    // cannot poison a later OTP login. On success PublicLayout consumes the
    // path itself, because the GET_CURRENT_USER refetch renders the logged-in
    // user before this effect resumes after `loginWithSso`.
    if (idpError) {
      clearPostLoginRedirect()

      if (idpError === 'access_denied') {
        setForbidden(true)
        return
      }

      const description = safeIdpErrorDescription(idpErrorDescription)
      setFailureMessage(
        description
          ? `There was an error logging you in (${description}). Please try again.`
          : null,
      )
      setFailed(true)
      return
    }

    const authCode = searchParams.get('code')
    const state = searchParams.get('state')
    const iss = searchParams.get('iss')

    if (!authCode || !state || !iss) {
      clearPostLoginRedirect()
      setFailed(true)
      return
    }

    const callMutation = async () => {
      await loginWithSso({
        variables: {
          input: {
            authCode,
            state,
            iss,
          },
        },
        onError: (error) => {
          if (parseGraphqlError(error).code === FORBIDDEN) {
            setForbidden(true)
            return
          }
          setFailed(true)
        },
      })
    }

    callMutation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isForbidden) {
    // Otherwise a later OTP/SGID login inherits this abandoned target.
    clearPostLoginRedirect()
    return <Navigate to={URLS.LOGIN_UNAUTHORIZED} replace />
  }

  if (hasFailed) {
    clearPostLoginRedirect()
    toast({
      title:
        failureMessage ??
        'There was an error logging you in. Please try again.',
      status: 'error',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right',
    })
    return <Navigate to={URLS.LOGIN} replace />
  }

  return <SsoLoadingScreen />
}
