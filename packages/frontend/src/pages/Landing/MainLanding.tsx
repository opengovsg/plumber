import {
  Center,
  Container,
  HStack,
  Image,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import leftLandingImg from 'assets/landing/left-landing.svg'
import rightLandingImg from 'assets/landing/right-landing.svg'
import mainLogo from 'assets/logo.svg'

const HeaderBar = () => {
  return (
    <Container>
      <HStack justify="space-between">
        <HStack>
          <Image src={mainLogo} alt="plumber-logo" />
          <Text textStyle="logo">plumber</Text>
        </HStack>
        <HStack spacing={8}>
          <Button variant="link" colorScheme="secondary">
            Guide
          </Button>
          <Button>Login</Button>
        </HStack>
      </HStack>
    </Container>
  )
}

export const MainLanding = () => {
  return (
    <>
      <HeaderBar />
      <Container maxW="1600px" px={0}>
        <Center position="relative">
          <Image
            position="absolute"
            left={0}
            src={leftLandingImg}
            alt="left-landing"
          />
          <VStack
            textAlign="center"
            py="10vh"
            w="45rem"
            maxW="100%"
            px="5vw"
            spacing={8}
          >
            <Text textStyle="heading">
              Focus on more
              <br />
              important work
            </Text>
            <Text>
              Let Plumber handle your manual and repetitive tasks so you can
              deliver value in other areas.
            </Text>
            <Button w="xs">Get started</Button>
          </VStack>
          <Image
            position="absolute"
            right={30}
            src={rightLandingImg}
            alt="right-landing"
          />
        </Center>
      </Container>
    </>
  )
}
