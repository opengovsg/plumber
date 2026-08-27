import { useEffect, useRef, useState } from 'react'
import { BsArrowRight } from 'react-icons/bs'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Icon, Image, Text, VStack } from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import mainLogo from '@/assets/logo.svg'
import PrimarySpinner from '@/components/PrimarySpinner'
import { FORBIDDEN } from '@/config/errors'
import * as URLS from '@/config/urls'
import { LOGIN_WITH_SSO } from '@/graphql/mutations/login-with-sso'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'
import { parseGraphqlError } from '@/helpers/parseGraphqlError'

export default function SsoCallback(): JSX.Element {
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const [hasFailed, setFailed] = useState<boolean>(false)
  const [isForbidden, setForbidden] = useState<boolean>(false)
  const [loginWithSso] = useMutation(LOGIN_WITH_SSO, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
  })

  // Account for React strict mode.
  const alreadyProcessed = useRef(false)

  useEffect(() => {
    if (alreadyProcessed.current) {
      return
    }

    alreadyProcessed.current = true

    const authCode = searchParams.get('code')
    const state = searchParams.get('state')
    const iss = searchParams.get('iss')

    if (!authCode || !state || !iss) {
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
    return <Navigate to={URLS.LOGIN_UNAUTHORIZED} replace />
  }

  if (hasFailed) {
    toast({
      title: 'There was an error logging you in. Please try again.',
      status: 'error',
      duration: 3000,
      isClosable: true,
      position: 'bottom-right',
    })
    return <Navigate to={URLS.LOGIN} replace />
  }

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" gap={8}>
      <Flex alignItems="center" justifyContent="center" gap={8}>
        <Text fontSize="5xl" fontWeight="bold">
          one.gov.sg
        </Text>
        <Icon as={BsArrowRight} boxSize={8} color="primary.500" />
        <Image src={mainLogo} alt="plumber-logo" w={12} mr={12} />
      </Flex>
      <PrimarySpinner fontSize="3xl" thickness="4px" pr={10} />
    </VStack>
  )
}
