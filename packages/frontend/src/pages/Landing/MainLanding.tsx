import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  HStack,
  Image,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
import PlumberLandingAnimation from 'assets/landing/PlumberLandingAnimation.json'
import brandmarkLogo from 'assets/logo.svg'
import mainLogo from 'assets/plumber-logo.svg'
import LottieWebAnimation from 'components/NewsDrawer/LottieWebAnimation'
import * as URLS from 'config/urls'

const HeaderBar = () => {
  const navigate = useNavigate()
  const imgSrc = useBreakpointValue({
    base: brandmarkLogo,
    md: mainLogo,
  })
  return (
    <Container px={6}>
      <HStack justify="space-between">
        <HStack>
          <Image h={10} src={imgSrc} alt="plumber-logo" />
        </HStack>
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

export default function MainLanding() {
  const navigate = useNavigate()
  return (
    <>
      <HeaderBar />
      <Container position="relative" py={0} px={6}>
        <HStack
          wrap={{ base: 'wrap', md: 'nowrap' }}
          gap={{ base: '2rem', md: 0 }}
        >
          <VStack
            align="start"
            py={{ base: '0vh', md: '10vh' }}
            w="100%"
            maxW={{ base: 'unset', lg: '35rem' }}
            spacing={8}
          >
            <Text
              textStyle={{ base: 'heading', md: 'subheading', lg: 'heading' }}
            >
              Automating
              <br />
              300,000+ tasks
              <br />
              for public service
            </Text>
            <Text textStyle="subhead-1">
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
          <LottieWebAnimation
            title="right-landing"
            animationData={PlumberLandingAnimation}
          ></LottieWebAnimation>
        </HStack>
      </Container>
    </>
  )
}
