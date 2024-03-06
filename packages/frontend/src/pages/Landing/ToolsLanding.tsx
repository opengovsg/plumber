import { Box, Container, HStack, Text, VStack } from '@chakra-ui/react'

import AppGrid from './components/AppGrid'
import { COMMON_APPS, CUSTOM_APPS } from './components/AppList'

export default function ToolsLanding() {
  return (
    <Container py="88px" px={6}>
      <Text textStyle="h1" color="primary.600" mb={16}>
        Our tools and integrations
      </Text>
      <VStack gap={16} align="start">
        <VStack gap={12}>
          <Box>
            <Text textStyle="h5" color="primary.600" mb={2}>
              Custom Plumber Apps
            </Text>
            <Text textStyle="body-1">
              Plumber has a variety of internal tools that can help you do more
              with your workflow. Set up conditional and branching logic to
              carry out different workflows.
            </Text>
          </Box>
          <AppGrid appIntegrations={CUSTOM_APPS}></AppGrid>
        </VStack>
        <HStack gap={14} spacing={0} wrap={{ base: 'wrap', md: 'nowrap' }}>
          <VStack align="start">
            <Text textStyle="h5" color="primary.600">
              Integrations
            </Text>
            <Text textStyle="body-1">
              We integrate with OGP products and other popular applications used
              across government.
            </Text>
          </VStack>
          <AppGrid appIntegrations={COMMON_APPS}></AppGrid>
        </HStack>
      </VStack>
    </Container>
  )
}
