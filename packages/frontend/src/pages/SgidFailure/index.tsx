import { BiSad } from 'react-icons/bi'
import { Box, Center, Flex, Heading, Icon, Link, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import * as URLS from 'config/urls'
import { SGID_CHECK_ELIGIBILITY_URL } from 'helpers/sgid'

export default function SgidFailure(): JSX.Element {
  return (
    <Center flex={1}>
      <Flex flexDir="column" w="50rem" alignItems="center">
        <Icon boxSize={40} as={BiSad} />
        <Box w="fit-content" my={12}>
          <Heading textAlign="center" mb={4}>
            Oops, we don't have your employee profile in the system
          </Heading>
          <Text textStyle="body-1" textAlign="center">
            Please check{' '}
            <Link target="_blank" href={SGID_CHECK_ELIGIBILITY_URL}>
              here
            </Link>{' '}
            if your government agency is supported. Meanwhile, login via your
            email instead.
          </Text>
        </Box>
        <Button px={6} as="a" href={`${URLS.LOGIN}?disable_singpass=1`}>
          Use Email Login
        </Button>
      </Flex>
    </Center>
  )
}
