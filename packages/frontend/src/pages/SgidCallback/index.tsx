import { useEffect, useRef, useState } from 'react'
import { BsArrowRight } from 'react-icons/bs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Flex, Icon, Image, Spinner, VStack } from '@chakra-ui/react'
import mainLogo from 'assets/logo.svg'
import sgidLogo from 'assets/sgid-logo.svg'
import * as URLS from 'config/urls'
import { LOGIN_WITH_SGID } from 'graphql/mutations/login-with-sgid'
import { useSnackbar } from 'notistack'

import SgidAccountSelect, { type Employment } from './SgidAccountSelect'

export default function SgidCallback(): JSX.Element {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [hasFailed, setFailed] = useState<boolean>(false)
  const [employments, setEmployments] = useState<Employment[] | null>(null)
  const [loginWithSgid] = useMutation(LOGIN_WITH_SGID)

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

      // See comments in loginWithSgid mutation for details on these values.
      if (publicOfficerEmployments.length === 0) {
        navigate(`${URLS.LOGIN}/?not_sgid_eligible=1`, { replace: true })
      } else if (publicOfficerEmployments.length === 1) {
        navigate(URLS.FLOWS, { replace: true })
      } else {
        setEmployments(publicOfficerEmployments)
      }
    }

    callMutation()
  }, [])

  if (hasFailed) {
    enqueueSnackbar('There was an error logging you in. Please try again.', {
      variant: 'error',
    })
    navigate(URLS.LOGIN, { replace: true })
    return <></>
  }

  return (
    <VStack flex={1} alignItems="center" justifyContent="center" gap={8}>
      <Flex alignItems="center" justifyContent="center" gap={8}>
        <Image src={sgidLogo} alt="plumber-logo" w={24} />
        <Icon as={BsArrowRight} boxSize={8} color="primary.600" />
        <Image src={mainLogo} alt="plumber-logo" w={12} mr={12} />
      </Flex>

      {employments ? (
        <SgidAccountSelect employments={employments} setFailed={setFailed} />
      ) : (
        <Spinner size="xl" thickness="4px" color="primary.500" margin="auto" />
      )}
    </VStack>
  )
}
