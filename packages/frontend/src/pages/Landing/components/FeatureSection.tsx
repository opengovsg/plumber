import React from 'react'
import { Box, Grid, Heading, Image, Stack, Text } from '@chakra-ui/react'
import Lottie from 'lottie-react'

interface Feature {
  name: string
  description: string
}

interface FeatureSectionProps {
  title: string
  features: Feature[]
  imageSrc?: string
  lottieData?: any
  imagePosition?: 'left' | 'right'
}

export const FeatureSection: React.FC<FeatureSectionProps> = ({
  title,
  features,
  imageSrc,
  lottieData,
  imagePosition = 'right',
}) => {
  const ImageComponent = () => {
    if (lottieData) {
      return (
        <Box
          m="24px"
          px={{ lg: 0 }}
          mb="40px"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="16px"
          height="auto"
          width="auto"
          overflow="hidden"
        >
          <Lottie
            animationData={lottieData}
            loop
            autoplay
            style={{ width: 'auto', height: 'auto' }}
          />
        </Box>
      )
    }

    if (imageSrc) {
      return (
        <Box px={{ base: '24px', lg: 0 }}>
          <Image
            alt="Product screenshot"
            src={imageSrc}
            border="1px solid"
            borderColor="whiteAlpha.200"
            width="100%"
            height="100%"
          />
        </Box>
      )
    }

    return null
  }

  const ContentComponent = () => (
    <Box
      px={{ base: 6, lg: imagePosition === 'left' ? 0 : '96px' }}
      pt={{ lg: 4 }}
      pr={{ lg: 24 }}
    >
      <Box maxW="2xl" mx="auto" sx={{ lg: { mx: 0, maxW: 'lg' } }}>
        <Heading
          mt={2}
          mb={8}
          fontSize={{ base: '4xl', sm: '5xl', lg: '44px' }}
          fontWeight="500"
          color="gray.900"
          letterSpacing="tighter"
        >
          {title}
        </Heading>

        <Stack
          spacing={8}
          maxW={{ lg: imagePosition === 'left' ? 'md' : 'xl', base: '2xl' }}
          color="gray.600"
          mb={10}
        >
          {features.map((feature) => (
            <Box key={feature.name} pl={0} position="relative">
              <Text
                as="dt"
                display="inline"
                fontWeight="semibold"
                color="primary.500"
              >
                {feature.name}
              </Text>{' '}
              <Text as="dd" display="inline">
                {feature.description}
              </Text>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )

  return (
    // Background is white to stop the SVG pattern from showing through
    <Box bg="white" pt={{ base: 24, sm: 32 }} overflow="hidden">
      <Box maxW="7xl" mx="auto" px={{ base: 0, md: 6, lg: 8 }}>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: 16, sm: 20, lg: 8 }}
          alignItems="center"
        >
          {imagePosition === 'left' ? (
            <>
              <ImageComponent />
              <ContentComponent />
            </>
          ) : (
            <>
              <ContentComponent />
              <ImageComponent />
            </>
          )}
        </Grid>
      </Box>
    </Box>
  )
}
