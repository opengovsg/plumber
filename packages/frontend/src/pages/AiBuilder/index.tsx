import { Helmet } from 'react-helmet'
import { BiChevronLeft } from 'react-icons/bi'
import { Link, useLocation } from 'react-router-dom'
import { Box, Container, Flex, HStack, Icon, Text } from '@chakra-ui/react'
import { Tag } from '@opengovsg/design-system-react'

import { EDITOR_MARGIN_TOP } from '@/components/Editor/constants'
import * as URLS from '@/config/urls'
import InvalidEditorPage from '@/pages/Editor/components/InvalidEditorPage'

import StepsPreview from './components/StepsPreview'
import {
  AiBuilderContextProvider,
  useAiBuilderContext,
} from './AiBuilderContext'

function AiBuilderContent() {
  const { flowName, isFormMode } = useAiBuilderContext()

  return (
    <>
      <Helmet>
        <title>{flowName} | WIP</title>
      </Helmet>
      <Flex h="100vh" flexDirection="column">
        <HStack
          position="fixed"
          top={0}
          left={0}
          right={0}
          zIndex={10}
          bg="white"
          justifyContent="space-between"
          alignItems="center"
          py={2}
          px={{ base: 4, md: 8 }}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          <Flex flex={1} alignItems="center" minWidth={0}>
            <Box as={Link} to={URLS.FLOWS} mt={1} mr={3} flexShrink={0}>
              <Icon
                boxSize={6}
                color="interaction.support.disabled-content"
                as={BiChevronLeft}
              ></Icon>
            </Box>

            <Flex flex={1} minWidth={0}>
              <Text>{flowName}</Text>
            </Flex>
          </Flex>
          {/* TODO: Add <AiBuilderToolbar /> */}
        </HStack>
        <Container
          maxW="full"
          px={0}
          py={10}
          mt={EDITOR_MARGIN_TOP}
          flex={1}
          overflowY="auto"
          sx={{
            backgroundImage: 'radial-gradient(#f5f5f5 2px, transparent 2px)',
            backgroundSize: '30px 30px',
          }}
        >
          {isFormMode ? (
            <StepsPreview />
          ) : (
            <Flex
              sx={{
                backgroundImage:
                  'radial-gradient(#f5f5f5 2px, transparent 2px)',
                backgroundSize: '30px 30px',
              }}
              h="100%"
              w="full"
              flexDir="column"
              alignItems="center"
              justifyContent="center"
              gap={4}
            >
              <Tag colorScheme="secondary">Build with AI</Tag>
              <Text textStyle="h3">What happens in your workflow?</Text>
              {/* TODO: Add chat interface */}
            </Flex>
          )}
        </Container>
      </Flex>
    </>
  )
}

export default function AiBuilder() {
  const { flowName, formInput, isFormMode, output } = useLocation()?.state || {
    flowName: 'New flow',
    isFormMode: false,
    formInput: {
      trigger: '',
      actions: '',
    },
    output: {
      trigger: '',
      actions: '',
    },
  }

  /**
   * NOTE: if isFormMode is true, we validate that the formInput exists.
   * if it does not exist, we don't bother showing the AiBuilder
   * since it will waste an API call to Pair
   */
  if (isFormMode && (!formInput || !formInput.trigger || !formInput.actions)) {
    return (
      <InvalidEditorPage message="Something went wrong. Please try again." />
    )
  }

  return (
    <AiBuilderContextProvider
      flowName={flowName}
      formInput={formInput}
      isFormMode={isFormMode}
      output={output}
    >
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
