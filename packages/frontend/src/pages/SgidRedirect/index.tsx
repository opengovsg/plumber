import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Center, CircularProgress, Flex, Link, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { LOGIN_WITH_SGID } from 'graphql/mutations/login-with-sgid'

export default function SgidRedirect(): JSX.Element {
  const [loginWithSgid] = useMutation(LOGIN_WITH_SGID)
  const [searchParams] = useSearchParams()
  const [hasFailed, setFailed] = useState<boolean>(false)

  // Account for React strict mode.
  const alreadyProcessed = useRef(false)

  useEffect(() => {
    if (alreadyProcessed.current) {
      return
    }

    alreadyProcessed.current = true

    const authCode = searchParams.get('code')
    const verifier = sessionStorage.getItem('sgid-verifier')
    const nonce = sessionStorage.getItem('sgid-nonce')

    sessionStorage.removeItem('sgid-verifier')
    sessionStorage.removeItem('sgid-nonce')

    if (!authCode || !verifier || !nonce) {
      setFailed(true)
      return
    }

    const callMutation = async () => {
      const result = await loginWithSgid({
        variables: {
          input: {
            type: 'INITIAL_STEP',
            initialStep: {
              authCode,
              verifier,
              nonce,
            },
          },
        },
        onError: () => setFailed(true),
      })

      // Temporarily unknown array; next PRs will type this more strongly when
      // we support multiple-hatted users.
      const publicOfficerEmployments = result.data?.loginWithSgid
        ?.publicOfficerEmployments as unknown[]

      if (!publicOfficerEmployments) {
        setFailed(true)
        return
      }

      // See comments in loginWithSgid mutation for details on these values.
      if (publicOfficerEmployments.length === 0) {
        location.assign(`${URLS.LOGIN}/?not_sgid_eligible=1`)
      } else if (publicOfficerEmployments.length === 1) {
        location.assign(URLS.FLOWS)
      } else {
        // Multi-hat case. Fail for now.
        location.assign(`${URLS.LOGIN}/?not_sgid_eligible=1`)
      }
    }

    callMutation()
  }, [])

  return (
    <Center flex={1}>
      {hasFailed ? (
        <Infobox variant="error">
          <Text>
            There was an error logging you in. Please try again{' '}
            <Link href={URLS.LOGIN}>here</Link>.
          </Text>
        </Infobox>
      ) : (
        <Flex alignItems="center">
          <CircularProgress isIndeterminate size={10} mr={3} />
          <Text>Logging you in...</Text>
        </Flex>
      )}
    </Center>
  )
}
