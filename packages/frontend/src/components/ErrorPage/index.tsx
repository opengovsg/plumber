import type { ReactNode } from 'react'
import { Box, Flex, Heading, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { BrokenPipeIcon } from '@/components/Icons'

export default function ErrorPage({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  return (
    <Flex minH="100vh" align="center" justify="center" bg="primary.50" px={4}>
      <Box textAlign="center" maxW="md">
        <Icon as={BrokenPipeIcon} boxSize="120px" color="primary.200" />
        {children}
        <Button mt={8} as="a" href="/">
          Back to home
        </Button>
      </Box>
    </Flex>
  )
}

function ErrorStatus({
  label,
  heading,
  children,
}: {
  label: string
  heading: string
  children?: ReactNode
}): JSX.Element {
  return (
    <>
      <Text
        fontSize="8xl"
        fontWeight="bold"
        color="primary.200"
        lineHeight="1"
        mt={4}
      >
        {label}
      </Text>
      <Heading as="h1" size="lg" color="base.content.strong" mt={4}>
        {heading}
      </Heading>
      {children}
    </>
  )
}

export function Error403PageContent(): JSX.Element {
  return (
    <ErrorStatus label="403" heading="You do not have access to Plumber">
      <Text mt={4} color="base.content.medium">
        Your one.gov.sg account was verified, but this product does not
        currently admit your account.
      </Text>
    </ErrorStatus>
  )
}

export function Error404PageContent(): JSX.Element {
  return <ErrorStatus label="404" heading="This pipe leads nowhere" />
}

export function ErrorUnexpectedPageContent(): JSX.Element {
  return <ErrorStatus label="Oops" heading="Something went wrong" />
}
