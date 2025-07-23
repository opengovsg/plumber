import {
  AspectRatio,
  Box,
  Container,
  Heading,
  HStack,
  Image,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react'

import AgcLogo from '@/assets/landing/AgcLogo.svg'
import * as URLS from '@/config/urls'

const posts = [
  {
    title:
      "How Attorney General's Chamber reduced 50% of time spent on administrative onboarding processes",
    href: URLS.HUMAN_RESOURCE,
    description: ' ',
    imageUrl: AgcLogo,
    agency: "Attorney General's Chamber",
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
            align="stretch"
          >
            {posts.map((post, index) => (
              <Box
                key={index}
                as="article"
                position="relative"
                display="flex"
                flexDirection={{ base: 'column', lg: 'row' }}
                gap={8}
              >
                <Box
                  position="relative"
                  width={{ lg: '64' }}
                  flexShrink={{ lg: 0 }}
                >
                  <AspectRatio ratio={{ base: 16 / 9, sm: 2 / 1, lg: 1 }}>
                    <Box position="relative">
                      <Image
                        src={post.imageUrl}
                        alt=""
                        position="absolute"
                        inset={0}
                        w="full"
                        h="full"
                        borderRadius="2xl"
                        bg="gray.50"
                        objectFit="cover"
                      />
                      <Box
                        position="absolute"
                        inset={0}
                        borderRadius="2xl"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        opacity={0.1}
                      />
                    </Box>
                  </AspectRatio>
                </Box>

                <Box flex={1} alignContent="center">
                  <HStack spacing={4} fontSize="m">
                    <Text color="gray.500">{post.agency}</Text>
                  </HStack>

                  <Box
                    position="relative"
                    maxW="xl"
                    role="group"
                    _hover={{ '& h3': { color: 'gray.600' } }}
                  >
                    <Heading
                      as="h3"
                      mt={3}
                      fontSize="lg"
                      lineHeight="6"
                      fontWeight="500"
                      letterSpacing="tighter"
                      color="gray.900"
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
                        <Box position="absolute" inset={0} />
                        {post.title}
                      </Link>
                    </Heading>

                    <Text mt={5} fontSize="sm" lineHeight="6" color="gray.600">
                      {post.description}
                    </Text>
                  </Box>
                </Box>
              </Box>
            ))}
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
