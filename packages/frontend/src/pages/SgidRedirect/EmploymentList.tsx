import { useCallback } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { Flex, Heading, Icon, Link, Text } from '@chakra-ui/react'
import * as URLS from 'config/urls'
import { LOGIN_WITH_SELECTED_SGID } from 'graphql/mutations/login-with-selected-sgid'

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

export default function EmploymentList(
  props: EmploymentListProps,
): JSX.Element {
  const { employments, setFailed } = props

  const [loginWithSelectedSgid] = useMutation(LOGIN_WITH_SELECTED_SGID)

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
        location.assign(URLS.FLOWS)
      }
    },
    [setFailed],
  )

  return (
    <Flex flexDir="column" w="50rem">
      <Heading textAlign="center" mb={8}>
        Choose an account to continue to Plumber
      </Heading>
      {employments.map((employment, index) => (
        <Flex
          key={index}
          px={6}
          py={7}
          alignItems="center"
          onClick={() => onSelectEmployment(employment.workEmail)}
          _hover={{ bg: 'interaction.muted.neutral.hover', cursor: 'pointer' }}
          _active={{ bg: 'interaction.muted.neutral.active' }}
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
          <Icon as={BiChevronRight} boxSize={6} ml="auto" />
        </Flex>
      ))}
      <Text textAlign="center" mt={8}>
        <Link textDecoration="none" href={URLS.LOGIN}>
          Or, log in manually using email and OTP
        </Link>
      </Text>
    </Flex>
  )
}
