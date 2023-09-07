import { useCallback } from 'react'
import { BiChevronRight } from 'react-icons/bi'
import { type ApolloError, type MutationFunction } from '@apollo/client'
import { Flex, Heading, Icon, Link, Text } from '@chakra-ui/react'
import * as URLS from 'config/urls'

export interface Employment {
  workEmail: string | null
  agencyName: string | null
  departmentName: string | null
  employmentTitle: string | null
}

interface EmploymentListProps {
  employments: Employment[]
  loginWithSgid: MutationFunction
  loginErrored: ApolloError | undefined
  setFailed: (failed: boolean) => void
}

export default function EmploymentList(
  props: EmploymentListProps,
): JSX.Element {
  const { employments, loginWithSgid, loginErrored, setFailed } = props

  const onSelectEmployment = useCallback(
    async (index: number) => {
      const result = await loginWithSgid({
        variables: {
          input: {
            type: 'SPECIFIC_EMPLOYMENT',
            specificEmployment: {
              employmentIndex: index,
            },
          },
        },
      })

      const nextUrl = result.data?.loginWithSgid?.nextUrl

      if (loginErrored || !nextUrl) {
        setFailed(true)
      } else {
        location.assign(nextUrl)
      }
    },
    [loginWithSgid, loginErrored, setFailed],
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
          onClick={() => onSelectEmployment(index)}
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
