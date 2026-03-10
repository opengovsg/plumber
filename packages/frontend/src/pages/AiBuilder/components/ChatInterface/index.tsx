import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Text } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'
import { StickToBottom } from 'use-stick-to-bottom'

import * as URLS from '@/config/urls'
import { useChatStream } from '@/hooks/useChatStream'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import ChatMessages from '@/pages/AiBuilder/components/ChatMessages'

import PromptInput from './PromptInput'
import ScrollButton from './ScrollButton'
import SideDrawer from './SideDrawer'

export default function ChatInterface() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { flowName, chatInput, chatMessages, output } = useAiBuilderContext()

  const {
    messages,
    currentResponse,
    isStreaming,
    isReady: isReadyForPreview,
    sendMessage,
    cancelStream,
  } = useChatStream({ initialMessages: chatMessages })

  const [isDrawerOpen, setIsDrawerOpen] = useState(
    Boolean(output?.trigger || output?.actions?.length),
  )

  const hasMessages = messages.length > 0 || isStreaming

  const handleOpenPreview = useCallback(() => {
    if (chatInput !== messages[messages.length - 1].text) {
      navigate(`${URLS.EDITOR}/ai`, {
        state: {
          ...location.state,
          flowName,
          chatInput: messages[messages.length - 1].text,
          chatMessages: messages,
        },
        replace: true,
      })
    }
    setIsDrawerOpen(true)
  }, [chatInput, messages, location.state, flowName, navigate])

  // Auto-open preview when streaming completes and result is ready
  useEffect(() => {
    if (hasMessages && !isStreaming && isReadyForPreview) {
      handleOpenPreview()
    }
  }, [isStreaming, hasMessages, isReadyForPreview, handleOpenPreview])

  if (!hasMessages) {
    return (
      <Flex
        h="100%"
        w="full"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        gap="1.5rem"
        px={4}
      >
        {messages.length === 0 && (
          <Text textStyle="h3">What happens in your workflow?</Text>
        )}
        <Box w="full" maxW="2xl" overflowY="auto" maxH="100vh">
          <PromptInput
            sendMessage={sendMessage}
            isStreaming={isStreaming}
            cancelStream={cancelStream}
            showIdeas={true}
            placeholder="Tell us step-by-step what happens in your workflow"
          />
        </Box>
      </Flex>
    )
  }

  return (
    <Flex h="100%" w="full" position="relative" overflow="hidden">
      <Flex
        h="100%"
        w="full"
        flexDir="column"
        position="relative"
        pr={isDrawerOpen && !isMobile ? '50%' : '0'}
        transition="padding-right 0.3s ease-in-out"
      >
        <StickToBottom
          resize="smooth"
          initial="smooth"
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <ChatMessages
            messages={messages}
            currentResponse={currentResponse}
            isStreaming={isStreaming}
          />

          <Box
            borderTop="1px"
            borderColor="gray.200"
            bg="white"
            w="full"
            flexShrink={0}
            position="relative"
          >
            <Box maxW="4xl" mx="auto" p={4}>
              <ScrollButton />
              <PromptInput
                sendMessage={sendMessage}
                isStreaming={isStreaming}
                cancelStream={cancelStream}
              />
            </Box>
          </Box>
        </StickToBottom>
      </Flex>
      <SideDrawer isOpen={isDrawerOpen} />
    </Flex>
  )
}
