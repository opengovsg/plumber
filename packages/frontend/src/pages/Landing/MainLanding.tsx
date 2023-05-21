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
        <a href="/">
          <HStack userSelect="none" cursor="pointer">
            <Image src={mainLogo} alt="plumber-logo" />
            <Text textStyle="logo" display={{ base: 'none', md: 'block' }}>
              plumber
            </Text>
          </HStack>
        </a>
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
      <Container maxW="1600px" position="relative">
        <Center>
          <VStack
            textAlign={{ base: 'left', md: 'center' }}
            align={{ base: 'start', md: 'center' }}
            py={{ base: '0vh', md: '10vh' }}
            w="100%"
            maxW={{ base: 'unset', lg: '35rem' }}
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
            <Button w={{ base: 'full', md: 'xs' }}>Get started</Button>
          </VStack>
        </Center>
        <HStack
          position={{ base: 'relative', lg: 'absolute' }}
          h={{ base: 'fit-content', lg: '100%' }}
          w="100%"
          margin="auto"
          pt={{ base: 16, md: 0 }}
          pr={2}
          top={0}
          left={0}
          justify="space-between"
        >
          <Image
            src={leftLandingImg}
            alt="left-landing"
            w={{ base: '45vw', md: 'auto' }}
          />
          <Image
            src={rightLandingImg}
            alt="right-landing"
            w={{ base: '35vw', md: 'auto' }}
          />
        </HStack>
      </Container>
    </>
  )
}
