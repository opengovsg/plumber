import { Box, Flex, Heading, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { BrokenPipeIcon } from '@/components/Icons'

export default function ErrorPage({
  is404,
  is403,
}: {
  is404?: boolean
  is403?: boolean
}): JSX.Element {
  const statusLabel = is403 ? '403' : is404 ? '404' : 'Oops'
  const heading = is403
    ? 'You do not have access to Plumber'
    : is404
    ? 'This pipe leads nowhere'
    : 'Something went wrong'

  return (
    <Flex minH="100vh" align="center" justify="center" bg="primary.50" px={4}>
      <Box textAlign="center" maxW="md">
        <Icon as={BrokenPipeIcon} boxSize="120px" color="primary.200" />
        <Text
          fontSize="8xl"
          fontWeight="bold"
          color="primary.200"
          lineHeight="1"
          mt={4}
        >
          {statusLabel}
        </Text>
        <Heading as="h1" size="lg" color="base.content.strong" mt={4}>
          {heading}
        </Heading>
        {is403 ? (
          <Text mt={4} color="base.content.medium">
            Your one.gov.sg account was verified, but this product does not
            currently admit your account.
          </Text>
        ) : null}
        <Button mt={8} as="a" href="/">
          Back to home
        </Button>
      </Box>
    </Flex>
  )
}
