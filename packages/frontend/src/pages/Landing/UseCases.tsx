import {
  Box,
  Container,
  Flex,
  Heading,
  HStack,
  Image,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react'

import AgcLogo from '@/assets/landing/AgcLogo.png'
import CaasLogo from '@/assets/landing/CaasLogo.png'
import GovTechLogo from '@/assets/landing/GOVTECH.png'
import * as URLS from '@/config/urls'

const posts = [
  {
    title:
      "How Attorney-General's Chambers reduced 50% of time spent on administrative onboarding processes",
    href: URLS.USE_CASES_SUBPAGE('human-resource'),
    description: ' ',
    imageUrl: AgcLogo,
    agency: "Attorney-General's Chambers",
  },
  {
    title:
      'How Civil Aviation Authority of Singapore simplified event management for their webinars',
    href: URLS.USE_CASES_SUBPAGE('operations'),
    description: ' ',
    imageUrl: CaasLogo,
    agency: 'Civil Aviation Authority of Singapore',
  },
  {
    title:
      'How GovTech automates employee support tickets to stay on top of queries and better serve employees',
    href: URLS.USE_CASES_SUBPAGE('customer-support'),
    description: ' ',
    imageUrl: GovTechLogo,
    agency: 'Government Technology Agency',
  },
]

export default function UseCases() {
  return (
    <Box bg="white" pt={{ base: 24, sm: 32 }} id="use-cases">
      <Container maxW="7xl" px={{ base: 6, lg: 8 }}>
        <Box maxW={{ base: '2xl', lg: '4xl' }} mx="auto">
          <Heading
            fontSize={{ base: '4xl', sm: '5xl', lg: '48px' }}
            fontWeight="500"
            color="gray.900"
            lineHeight="tight"
            letterSpacing="tighter"
            textAlign="center"
          >
            <Text
              as="span"
              fontWeight="500"
              color="primary.500"
              fontSize={{ base: '4xl', sm: '5xl', lg: '48px' }}
            >
              Plumber
            </Text>{' '}
            in government
          </Heading>

          <Text
            mt={2}
            fontSize="lg"
            lineHeight="8"
            color="gray.500"
            letterSpacing="tight"
            textAlign="center"
          >
            Learn how others are automating their workflows
          </Text>

          <VStack
            mt={{ base: 16, lg: 20 }}
            spacing={{ base: 20, lg: 20 }}
            align="center"
          >
            {posts.map((post, index) => (
              <Flex
                key={index}
                gap={8}
                alignItems={{ base: 'stretch', md: 'center' }}
                flexDirection={{ base: 'column', md: 'row' }}
              >
                <Link
                  href={post.href}
                  w={{ base: '100%', md: '30vw' }}
                  maxW={{ base: '100%', md: 48 }}
                  px={8}
                  bg="#f4f2f0"
                  borderRadius="2xl"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  aspectRatio={{ base: undefined, md: 1 }}
                  role="group"
                >
                  <Image
                    src={post.imageUrl}
                    aspectRatio="1"
                    maxW={{ base: 48, md: '100%' }}
                    transition="transform 0.2s"
                    objectFit="contain"
                    _groupHover={{
                      transform: 'scale(1.1)',
                    }}
                  />
                </Link>

                <Box flex={1} alignContent="center">
                  <HStack spacing={4} fontSize="m">
                    <Text color="gray.500">{post.agency}</Text>
                  </HStack>

                  <Heading
                    as="h3"
                    mt={3}
                    fontSize="lg"
                    lineHeight="6"
                    fontWeight="500"
                    letterSpacing="tighter"
                    transition="color 0.2s"
                  >
                    <Link
                      href={post.href}
                      textDecoration="none"
                      color="gray.900"
                      _hover={{
                        textDecoration: 'none',
                        color: 'primary.500',
                      }}
                    >
                      {post.title}
                    </Link>
                  </Heading>
                </Box>
              </Flex>
            ))}
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
