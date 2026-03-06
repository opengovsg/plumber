import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex, Text } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(
    Boolean(output?.trigger || output?.actions?.length),
  )
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const prevMessagesLengthRef = useRef(messages.length)
  const wasStreamingRef = useRef(isStreaming)
  const scrollTickRef = useRef(false)

  // Unified scroll function
  const scrollToBottom = useCallback(
    (behavior: 'smooth' | 'instant' | 'instant-native' = 'smooth') => {
      if (behavior === 'instant-native') {
        const container = messagesContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior })
      }
    },
    [],
  )

  // Scroll to bottom on initial mount using MutationObserver
  useLayoutEffect(() => {
    if (!chatMessages?.length) {
      setHasMounted(true)
      return
    }

    // First rAF: React commit is done, browser is about to paint
    // Second rAF: all child components (toolbar, etc.) have rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom('instant-native')
        setHasMounted(true)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll button visibility + auto-scroll on message/stream changes
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    const getIsNearBottom = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      return scrollHeight - scrollTop - clientHeight < 100
    }

    // Throttled scroll handler for button visibility
    const handleScroll = () => {
      if (scrollTickRef.current) {
        return
      }
      scrollTickRef.current = true
      requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = container
        setShowScrollButton(!getIsNearBottom() && scrollHeight > clientHeight)
        scrollTickRef.current = false
      })
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll()

    // Auto-scroll logic
    const isNearBottom = getIsNearBottom()
    const prevLength = prevMessagesLengthRef.current
    const newUserMessage =
      messages.length > prevLength &&
      messages[messages.length - 1]?.isUser === true
    const streamingJustEnded = wasStreamingRef.current && !isStreaming

    prevMessagesLengthRef.current = messages.length
    wasStreamingRef.current = isStreaming

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    if (newUserMessage) {
      scrollToBottom('smooth')
    } else if (isStreaming && isNearBottom) {
      scrollToBottom('instant')
    } else if (streamingJustEnded && isNearBottom) {
      timeoutId = setTimeout(() => scrollToBottom('smooth'), 100)
    }

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [messages, currentResponse, isStreaming, scrollToBottom])

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
        transition={hasMounted ? 'padding-right 0.3s ease-in-out' : 'none'}
      >
        <ChatMessages
          messages={messages}
          currentResponse={currentResponse}
          isStreaming={isStreaming}
          messagesEndRef={messagesEndRef}
          messagesContainerRef={messagesContainerRef}
        />

        <Box
          borderTop="1px"
          borderColor="gray.200"
          bg="white"
          w="full"
          position="relative"
        >
          {showScrollButton && (
            <ScrollButton onClick={() => scrollToBottom('smooth')} />
          )}
          <Box maxW="4xl" mx="auto" p={4}>
            <PromptInput
              sendMessage={sendMessage}
              isStreaming={isStreaming}
              cancelStream={cancelStream}
            />
          </Box>
        </Box>
      </Flex>

      <SideDrawer isOpen={isDrawerOpen} />
    </Flex>
  )
}
