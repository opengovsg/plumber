import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Center, CircularProgress, Link, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { LOGIN_WITH_SGID } from 'graphql/mutations/login-with-sgid'

import EmploymentList, { type Employment } from './EmploymentList'

export default function SgidRedirect(): JSX.Element {
  const [loginWithSgid, { error: loginErrored }] = useMutation(LOGIN_WITH_SGID)
  const [searchParams] = useSearchParams()

  const [hasFailed, setFailed] = useState<boolean>(false)
  const [employments, setEmployments] = useState<Employment[] | null>(null)

  useEffect(() => {
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
      })

      const nextUrl = result.data?.loginWithSgid?.nextUrl
      const publicOfficerEmployments = result.data?.loginWithSgid
        ?.publicOfficerEmployments as Employment[]

      if (loginErrored || (!nextUrl && !publicOfficerEmployments)) {
        setFailed(true)
        return
      }

      if (nextUrl) {
        location.assign(nextUrl)
      } else {
        setEmployments(publicOfficerEmployments)
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
            <Link href={URLS.LOGIN}>here.</Link>
          </Text>
        </Infobox>
      ) : employments ? (
        <EmploymentList
          employments={employments}
          loginWithSgid={loginWithSgid}
          loginErrored={loginErrored}
          setFailed={setFailed}
        />
      ) : (
        <CircularProgress isIndeterminate />
      )}
    </Center>
  )
}
