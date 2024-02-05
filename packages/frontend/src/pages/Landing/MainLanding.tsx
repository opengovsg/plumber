import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import {
  Container,
  HStack,
  Image,
  Skeleton,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react'
import { Button, Link } from '@opengovsg/design-system-react'
import plumberLandingGif from 'assets/landing/PlumberLandingAnimation.gif'
import brandmarkLogo from 'assets/logo.svg'
import mainLogo from 'assets/plumber-logo.svg'
import * as URLS from 'config/urls'
import { GET_PLUMBER_STATS } from 'graphql/queries/get-plumber-stats'

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

function estimateCountByHundreds(count: number): string {
  return count < 100
    ? count.toString()
    : (Math.round(count / 100) * 100).toLocaleString() + '+'
}

export default function MainLanding() {
  const navigate = useNavigate()

  const { loading, data } = useQuery(GET_PLUMBER_STATS)
  const userCount = data?.getPlumberStats.userCount
  const executionCount = data?.getPlumberStats.executionCount

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
              <Skeleton display="inline" isLoaded={!loading}>
                {estimateCountByHundreds(executionCount)} tasks
              </Skeleton>
              <br />
              for public service
            </Text>

            <Text textStyle="subhead-1">
              <Skeleton display="inline" isLoaded={!loading}>
                {estimateCountByHundreds(userCount)}
              </Skeleton>
              {` public officers have started automating their work`}
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
            src={plumberLandingGif}
            alt="right-landing-gif"
            h="auto"
            w={{ base: '80vw', md: '40vw' }}
          ></Image>
        </HStack>
      </Container>
    </>
  )
}
