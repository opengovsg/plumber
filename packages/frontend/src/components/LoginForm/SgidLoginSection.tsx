import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Flex, Image, Link, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import singpassLogo from '@/assets/singpass-logo.svg'
import { SGID_CHECK_ELIGIBILITY_URL } from '@/config/urls'
import { generateSgidAuthUrl } from '@/helpers/oidc'

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
      {hasError && (
        <Infobox variant="error" mb={2}>
          There was a problem generating encryption parameters; please visit our{' '}
          <Link href="https://go.gov.sg/plumber-support" isExternal>
            support form
          </Link>{' '}
          for help.
        </Infobox>
      )}

      <Flex flexDir="column" alignItems="center">
        <Button
          // isFullWidth a bit ugly
          width="full"
          variant="outline"
          mb={2}
          onClick={handleSgidLogin}
          isLoading={isRedirectingToSgid}
        >
          Log in with <Image src={singpassLogo} mb={-0.5} h={5} /> app
        </Button>
        <Text textStyle="body-2">
          Can my agency use this? Check{' '}
          <Link target="_blank" href={SGID_CHECK_ELIGIBILITY_URL}>
            here
          </Link>
        </Text>
      </Flex>
    </>
  ) : (
    <SgidFailureModal />
  )
}
