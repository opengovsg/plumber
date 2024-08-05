import { useEffect, useRef, useState } from 'react'
import { BsArrowRight } from 'react-icons/bs'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Icon, Image, VStack } from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import mainLogo from '@/assets/logo.svg'
import sgidLogo from '@/assets/sgid-logo.svg'
import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import { LOGIN_WITH_SGID } from '@/graphql/mutations/login-with-sgid'
import { GET_CURRENT_USER } from '@/graphql/queries/get-current-user'

import SgidAccountSelect, { type Employment } from './SgidAccountSelect'

export default function SgidCallback(): JSX.Element {
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [hasFailed, setFailed] = useState<boolean>(false)
  const [employments, setEmployments] = useState<Employment[] | null>(null)
  const [loginWithSgid] = useMutation(LOGIN_WITH_SGID, {
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
            authCode,
            verifier,
            nonce,
          },
        },
        onError: () => setFailed(true),
      })

      const publicOfficerEmployments = result.data?.loginWithSgid
        ?.publicOfficerEmployments as Employment[]

      if (!publicOfficerEmployments) {
        setFailed(true)
        return
      }

      setEmployments(publicOfficerEmployments)
    }

    callMutation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (employments?.length === 0) {
    return <Navigate to={`${URLS.LOGIN}/?not_sgid_eligible=1`} replace />
  }

  // this doesn't occur because of auth cookie set in login-with-sgid mutation
  if (employments?.length === 1) {
    return <Navigate to={URLS.FLOWS} replace />
  }

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" gap={8}>
      <Flex alignItems="center" justifyContent="center" gap={8}>
        <Image src={sgidLogo} alt="plumber-logo" w={24} />
        <Icon as={BsArrowRight} boxSize={8} color="primary.500" />
        <Image src={mainLogo} alt="plumber-logo" w={12} mr={12} />
      </Flex>

      {employments ? (
        <SgidAccountSelect employments={employments} setFailed={setFailed} />
      ) : (
        <PrimarySpinner size="xl" thickness="4px" margin="auto" />
      )}
    </VStack>
  )
}
