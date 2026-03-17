import { Box, Flex, Heading, Icon, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { BrokenPipeIcon } from '@/components/Icons'

export default function ErrorPage({ is404 }: { is404?: boolean }): JSX.Element {
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
          {is404 ? '404' : 'Oops'}
        </Text>
        <Heading as="h1" size="lg" color="base.content.strong" mt={4}>
          {is404 ? 'This pipe leads nowhere' : 'Something went wrong'}
        </Heading>
        <Button mt={8} as="a" href="/">
          Back to home
        </Button>
      </Box>
    </Flex>
  )
}
