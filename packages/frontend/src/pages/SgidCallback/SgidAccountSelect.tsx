import { useCallback } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Box, Divider, Flex, Heading, Icon, Link, Text } from '@chakra-ui/react'
import * as URLS from 'config/urls'
import { LOGIN_WITH_SELECTED_SGID } from 'graphql/mutations/login-with-selected-sgid'
import { GET_CURRENT_USER } from 'graphql/queries/get-current-user'

export interface Employment {
  workEmail: string
  agencyName: string | null
  departmentName: string | null
  employmentTitle: string | null
}

interface EmploymentListProps {
  employments: Employment[]
  setFailed: (failed: boolean) => void
}

export default function SgidAccountSelect(
  props: EmploymentListProps,
): JSX.Element {
  const { employments, setFailed } = props

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('state')

  const [loginWithSelectedSgid] = useMutation(LOGIN_WITH_SELECTED_SGID, {
    refetchQueries: [GET_CURRENT_USER],
    awaitRefetchQueries: true,
  })

  const onSelectEmployment = useCallback(
    async (workEmail: string) => {
      const result = await loginWithSelectedSgid({
        variables: {
          input: {
            workEmail,
          },
        },
        onError: () => setFailed(true),
      })

      const success = result.data?.loginWithSelectedSgid?.success

      if (!success) {
        setFailed(true)
      } else {
        return navigate(redirectUrl ?? URLS.DASHBOARD, { replace: true })
      }
    },
    [loginWithSelectedSgid, navigate, setFailed, redirectUrl],
  )

  return (
    <Flex flexDir="column" w="50rem" px={8} maxW="100%">
      <Heading textAlign="center" mb={8}>
        Choose an account to proceed
      </Heading>
      {employments.map((employment, index) => (
        <Box key={`employment_${index}`}>
          <Flex
            px={6}
            py={7}
            borderRadius="lg"
            cursor="pointer"
            alignItems="center"
            onClick={() => onSelectEmployment(employment.workEmail)}
            _hover={{ bg: 'primary.50' }}
            _active={{ bg: 'primary.100' }}
          >
            <Flex flexDir="column" gap={1}>
              <Text textStyle="subhead-1">{employment.workEmail}</Text>
              {employment.agencyName && (
                <Text textStyle="body-2">
                  {`${employment.agencyName}${
                    employment.departmentName
                      ? `, ${employment.departmentName}`
                      : ''
                  }`}
                </Text>
              )}
              {employment.employmentTitle && (
                <Text textStyle="body-2">{employment.employmentTitle}</Text>
              )}
            </Flex>
            <Icon
              as={BiChevronRight}
              boxSize={6}
              ml="auto"
              color="primary.500"
            />
          </Flex>
          {index < employments.length - 1 && (
            <Divider borderColor="primary.200" my={2} />
          )}
        </Box>
      ))}
      <Text textAlign="center" mt={8}>
        <Link textDecoration="none" href={URLS.LOGIN}>
          Or log in with email and OTP
        </Link>
      </Text>
    </Flex>
  )
}
