import { Box, Flex, Heading, HStack, Link, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import Lottie from 'lottie-react'

import HeroLottie from '@/assets/landing/HeroLottie.json'
import * as URLS from '@/config/urls'

import BackgroundPattern from './components/BackgroundPattern'

export default function HeroSection() {
  return (
    <Box position="relative" overflow="hidden">
      <BackgroundPattern />
      {/* CTA Section */}
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        maxW="7xl"
        mx="auto"
        px={{ base: 6, lg: 8 }}
        pt={{ base: 0, lg: 16 }}
      >
        {/* Left Column - Text */}
        <Box
          maxW="xl"
          mx="auto"
          pt={{ lg: 8 }}
          flexShrink={0}
          alignContent="center"
        >
          <Heading
            as="h1"
            mt={10}
            fontSize={{ base: '4xl', sm: '7xl', lg: '56px' }}
            fontWeight="500"
            color="gray.900"
            fontStyle="regular"
            letterSpacing="tighter"
          >
            The easiest no-code automation tool for public service
          </Heading>

          <Text
            mt={4}
            fontSize={{ base: 'md', sm: 'xl', lg: '2xl' }}
            fontWeight="400"
            color="gray.500"
            letterSpacing="tight"
          >
            Automate manual processes in hours, not weeks
          </Text>

          <HStack spacing={6} mt={10} align="center">
            <Button
              as="a"
              href={URLS.LOGIN}
              bg="primary.100"
              color="primary.500"
              borderColor="primary.100"
              px={4}
              py={2.5}
              fontSize="md"
              fontWeight="medium"
              _hover={{ bg: 'primary.200', color: 'primary.600' }}
              _focusVisible={{
                outline: '2px solid',
                outlineOffset: '2px',
                outlineColor: 'primary.500',
              }}
              shadow="xs"
            >
              Get started
            </Button>
            <Link
              href="use-cases"
              fontSize="md"
              fontWeight="500"
              color="gray.900"
              textDecoration="none"
              _hover={{ textDecoration: 'none' }}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('use-cases')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
            >
              See use cases
            </Link>
          </HStack>
        </Box>

        {/* Right Column - Image */}
        <Box
          mx="auto"
          mt={{ base: 16, sm: 24, lg: 0 }}
          ml={{ lg: 10, xl: 32 }}
          maxW={{ base: '2xl', lg: 'none' }}
          flex="none"
        >
          <Box
            maxW={{ base: '3xl', sm: '5xl', lg: 'none' }}
            flex="none"
            borderRadius="16px"
            overflow="hidden"
          >
            <Lottie
              animationData={HeroLottie}
              loop
              autoplay
              style={{ width: 'auto', height: 'auto' }}
            />
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}
