import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  HStack,
  Hide,
  Image,
  Show,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
//import leftLandingImg from 'assets/landing/left-landing.svg'
import PlumberLandingAnimation from 'assets/landing/PlumberLandingAnimation.svg'
import brandmarkLogo from 'assets/logo.svg'
import mainLogo from 'assets/plumber-logo.svg'
import * as URLS from 'config/urls'

const HeaderBar = () => {
  const navigate = useNavigate()
  return (
    <Container>
      <HStack justify="space-between">
        {/* <HStack
          userSelect="none"
          cursor="pointer"
          onClick={() => navigate(URLS.ROOT)}
        >
          <Image src={mainLogo} alt="plumber-logo" />
        </HStack> */}
        <Image
          src={mainLogo}
          alt="plumber-logo"
          display={{ base: 'none', md: 'inline' }}
        />
        <Image
          src={brandmarkLogo}
          alt="brandmark-logo"
          display={{ base: 'inline', md: 'none' }}
        />
        <HStack spacing={8}>
          <Button
            as={Link}
            href={URLS.STATUS_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            _hover={{ textDecoration: 'underline' }}
          >
            Status
          </Button>

          <Button
            as={Link}
            href={URLS.GUIDE_LINK}
            colorScheme="secondary"
            target="_blank"
            variant="link"
            _hover={{ textDecoration: 'underline' }}
          >
            Guide
          </Button>
          <Button onClick={() => navigate(URLS.LOGIN)}>Login</Button>
        </HStack>
      </HStack>
    </Container>
  )
}

export const MainLanding = () => {
  const navigate = useNavigate()
  return (
    <>
      <HeaderBar />
      <Container position="relative">
        <HStack
          wrap={{ base: 'wrap', md: 'nowrap', lg: 'nowrap' }}
          justifyContent="space-between"
          gap={8}
        >
          <VStack
            textAlign={{ base: 'left', md: 'left' }}
            align={{ base: 'left', md: 'left' }}
            py={{ base: '0vh', md: '10vh' }}
            w="100%"
            maxW={{ base: 'unset', lg: '35rem' }}
            spacing={8}
          >
            <Text textStyle="heading">
              Automating
              <br />
              300,000+ tasks
              <br />
              for public service
            </Text>
            <Text textStyle="subehad-1">
              1,900+ public officers have started automating their work
            </Text>
            <Button
              onClick={() => navigate(URLS.LOGIN)}
              w={{ base: 'full', md: 'xs' }}
              rightIcon={<BiRightArrowAlt fontSize="1.5rem" />}
            >
              Start automating your work
            </Button>
          </VStack>
          <Image
            src={PlumberLandingAnimation}
            alt="right-landing"
            w={{ base: '100%', md: 'auto' }}
          />
        </HStack>
      </Container>
    </>
  )
}
