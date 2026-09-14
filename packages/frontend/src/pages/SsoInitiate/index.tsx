import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { useToast } from '@opengovsg/design-system-react'

import SsoLoadingScreen from '@/components/SsoLoadingScreen'
import * as URLS from '@/config/urls'
import { START_SSO_LOGIN } from '@/graphql/mutations/start-sso-login'
import {
  clearPostLoginRedirect,
  storePostLoginRedirect,
} from '@/helpers/post-login-redirect'

export default function SsoInitiate(): JSX.Element {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [hasFailed, setFailed] = useState(false)
  const [startSsoLogin] = useMutation(START_SSO_LOGIN, {
    context: { autoSnackbar: false },
  })
  const alreadyProcessed = useRef(false)

  useEffect(() => {
    if (alreadyProcessed.current) {
      return
    }
    alreadyProcessed.current = true

    const target =
      searchParams.get('target_link_uri') ?? searchParams.get('redirect')
    storePostLoginRedirect(target)

    const iss = searchParams.get('iss')

    const start = async () => {
      try {
        const { data } = await startSsoLogin({
          variables: iss ? { input: { iss } } : {},
        })
        const authorizationUrl = data?.startSsoLogin?.authorizationUrl
        if (!authorizationUrl) {
          throw new Error('Missing authorization URL')
        }
        location.assign(authorizationUrl)
      } catch {
        // Otherwise a later OTP/SGID login inherits this abandoned target.
        clearPostLoginRedirect()
        setFailed(true)
      }
    }

    void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (hasFailed) {
    toast({
      title: 'There was an error starting SSO. Please try again.',
      status: 'error',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right',
    })
    return <Navigate to={URLS.LOGIN} replace />
  }

  return <SsoLoadingScreen />
}
