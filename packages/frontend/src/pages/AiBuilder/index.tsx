import { useRef } from 'react'
import { Helmet } from 'react-helmet'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CloseButton,
  Container,
  Flex,
  HStack,
  Text,
  useDisclosure,
} from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { useChatStream } from '@/hooks/useChatStream'

import ChatInterface from './components/ChatInterface'
import ExitAlert from './components/ExitAlert'
import {
  AiBuilderContextProvider,
  useAiBuilderContext,
} from './AiBuilderContext'

function AiBuilderContent() {
  const navigate = useNavigate()
  const { flowName, chatMessages } = useAiBuilderContext()

  const {
    messages,
    currentResponse,
    isStreaming,
    isReady: isReadyForPreview,
    sendMessage,
    cancelStream,
  } = useChatStream({ initialMessages: chatMessages })

  const cancelRef = useRef(null)
  const {
    isOpen: isWarningOpen,
    onOpen: onWarningOpen,
    onClose: onWarningClose,
  } = useDisclosure()

  const handleExit = () => {
    cancelStream()
    navigate(URLS.FLOWS)
  }

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
          <Flex flex={1} alignItems="center" minWidth={0} gap={2}>
            <CloseButton size="sm" onClick={onWarningOpen} />

            <Text>{flowName}</Text>
          </Flex>
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
          <ChatInterface
            messages={messages}
            currentResponse={currentResponse}
            isStreaming={isStreaming}
            isReadyForPreview={isReadyForPreview}
            sendMessage={sendMessage}
            cancelStream={cancelStream}
          />
        </Container>
      </Flex>
      <ExitAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onExit={handleExit}
      />
    </>
  )
}

export default function AiBuilder() {
  const { flowName, output, chatInput, chatMessages } = useLocation()
    ?.state || {
    flowName: 'Build with AI',
    chatInput: '',
    chatMessages: [],
    output: {
      trigger: '',
      actions: '',
      name: 'Build with AI',
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
