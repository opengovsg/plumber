import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AbsoluteCenter,
  Box,
  Divider,
  Flex,
  Link,
  Text,
} from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'
import { SGID_CHECK_ELIGIBILITY_URL } from 'config/urls'
import { generateSgidAuthUrl } from 'helpers/sgid'

import SgidFailureModal from './SgidFailureModal'

export default function SgidLoginSection(): JSX.Element {
  const [isRedirectingToSgid, setIsRedirectingToSgid] = useState(false)
  const [hasError, setHasError] = useState(false)

  const [searchParams] = useSearchParams()
  const canUseSgid = !searchParams.get('not_sgid_eligible')

  const handleSgidLogin = useCallback(
    async () => {
      setIsRedirectingToSgid(true)

      // Surround in try-catch to explicitly warn users on funky browsers about
      // failures to generate PKCE params, instead of letting error bubble up in
      // console.
      try {
        const { url, verifier, nonce } = await generateSgidAuthUrl()
        sessionStorage.setItem('sgid-verifier', verifier)
        sessionStorage.setItem('sgid-nonce', nonce)
        location.assign(url)
      } catch {
        setHasError(true)
      }
    },
    // Empty dep list as this is expected to be one-shot.
    [],
  )

  return canUseSgid ? (
    <>
      <Box position="relative" my="2.5rem">
        <Divider />
        <AbsoluteCenter>
          <Box bg="white" p={3}>
            <Text textStyle="subhead-1">or</Text>
          </Box>
        </AbsoluteCenter>
      </Box>

      {hasError && (
        <Infobox variant="error" mb={2}>
          There was a problem generating encryption parameters; please contact
          support@plumber.gov.sg for help.
        </Infobox>
      )}

      <Flex flexDir="column" alignItems="center">
        <Button
          // isFullWidth a bit ugly
          width="full"
          mb={2}
          onClick={handleSgidLogin}
          isLoading={isRedirectingToSgid}
        >
          Log in with SingPass
        </Button>
        <Text>
          Can my agency use this? Check{' '}
          <Link target="_blank" href={SGID_CHECK_ELIGIBILITY_URL}>
            here.
          </Link>
        </Text>
      </Flex>
    </>
  ) : (
    <SgidFailureModal />
  )
}
