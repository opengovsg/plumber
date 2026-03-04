import { Helmet } from 'react-helmet'
import { BiChevronLeft } from 'react-icons/bi'
import { Link, useLocation } from 'react-router-dom'
import { Box, Container, Flex, HStack, Icon, Text } from '@chakra-ui/react'

import * as URLS from '@/config/urls'

import ChatInterface from './components/ChatInterface'
import {
  AiBuilderContextProvider,
  useAiBuilderContext,
} from './AiBuilderContext'

function AiBuilderContent() {
  const { flowName } = useAiBuilderContext()

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
          py={0}
          mt="51.5px"
          flex={1}
          overflowY="auto"
          sx={{
            backgroundImage: 'radial-gradient(#f5f5f5 2px, transparent 2px)',
            backgroundSize: '30px 30px',
          }}
        >
          <ChatInterface />
        </Container>
      </Flex>
    </>
  )
}

export default function AiBuilder() {
  const { flowName, output, chatInput, chatMessages } = useLocation()
    ?.state || {
    flowName: 'New flow',
    chatInput: '',
    chatMessages: [],
    output: {
      trigger: '',
      actions: '',
    },
  }

  return (
    <AiBuilderContextProvider
      flowName={flowName}
      chatInput={chatInput}
      chatMessages={chatMessages}
      output={output}
    >
      <AiBuilderContent />
    </AiBuilderContextProvider>
  )
}
