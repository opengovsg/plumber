import { ReactElement } from 'react'
import { Box, Center, Flex, Image, Show, Text } from '@chakra-ui/react'
import landingImg from 'assets/plumber-landing.png'
import mainLogo from 'assets/plumber-logo.svg'
import LoginForm from 'components/LoginForm'

export default function Login(): ReactElement {
  return (
    <Flex flex={1} alignItems="stretch" flexDir={{ base: 'column', md: 'row' }}>
      {/* Left half of the page: Login graphic */}
      <Flex
        flex={1}
        flexDir="column"
        display={{ base: 'none', md: 'flex' }}
        bg="primary.50"
        color="primary.600"
        pt="3.75rem"
        gap={{ base: '3rem', lg: '4.5rem' }}
      >
        <Flex flexDir="column" gap={2} pl={11}>
          <Text textStyle="heavy" maxW="60%">
            Automate your manual and repetitive tasks
          </Text>
          <Text textStyle="body-1" maxW="80%">
            A no-code tool that connects multiple applications together to
            automate your workflows.
          </Text>
        </Flex>

        <Show above="md">
          <Center pr={8}>
            <Image
              src={landingImg}
              w={{ base: '80%', lg: '60%', '2xl': '65%' }}
              maxW="26rem"
            />
          </Center>
        </Show>
      </Flex>

      {/* Right half of the page: Login input */}
      <Flex flexDir="column" flex={1} gap={12} justifyContent="center" px="5vw">
        <Box>
          <Image h={10} src={mainLogo} alt="plumber-logo" />
        </Box>
        <LoginForm />
      </Flex>
    </Flex>
  )
}
