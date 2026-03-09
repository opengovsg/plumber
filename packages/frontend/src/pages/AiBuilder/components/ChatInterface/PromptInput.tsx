import {
  type FormEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useRef,
  useState,
} from 'react'
import { FaArrowCircleRight } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import { Box, Flex, Icon, Textarea } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import pairLogo from '@/assets/pair-logo.svg'
import { ImageBox } from '@/components/FlowStepConfigurationModal/ChooseAndAddConnection/ConfigureExcelConnection'
import IdeaButtons from '@/pages/AiBuilder/components/IdeaButtons'
import { AI_CHAT_IDEAS, type AiChatIdea } from '@/pages/AiBuilder/constants'

interface PromptInputProps {
  isStreaming: boolean
  showIdeas?: boolean
  placeholder?: string
  sendMessage: (message: string) => void
  cancelStream: () => void
}

export default function PromptInput({
  isStreaming,
  showIdeas = false,
  placeholder = 'Send a message',
  sendMessage,
  cancelStream,
}: PromptInputProps) {
  const isMobile = useIsMobile()
  const [input, setInput] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    if (input?.trim()) {
      sendMessage(input)
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleResize = (e?: FormEvent<HTMLTextAreaElement>) => {
    const target = e?.currentTarget || textareaRef.current
    if (!target) {
      return
    }
    const maxHeight = window.innerHeight * 0.4 - 100 // 40vh minus padding/margins
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px'
  }

  // only show idea buttons if showIdeas is true and the user has not entered any text
  const shouldShowIdeas = showIdeas && !input?.trim()

  return (
    <Box w="full" maxW="4xl">
      <Flex
        direction="row"
        align="stretch"
        bg="white"
        border="1px"
        borderColor="gray.200"
        borderRadius="16px"
        boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
        p={2}
        w="full"
        minH={showIdeas ? '120px' : '50px'}
        height="auto"
        mb={isMobile ? 0 : 6}
      >
        <Textarea
          ref={textareaRef}
          disabled={isStreaming}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          w="full"
          resize="none"
          border="none"
          bg="transparent"
          p={3}
          color="gray.900"
          _placeholder={{ color: 'gray.500' }}
          _focus={{ outline: 'none', boxShadow: 'none' }}
          _disabled={{ opacity: 1, bg: 'transparent', color: 'gray.900' }}
          fontSize="base"
          lineHeight="6"
          maxH="calc(40vh - 100px)"
          rows={1}
          overflowY="auto"
          sx={{
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            },
          }}
          onInput={handleResize}
          onFocus={(e) => {
            // prevent iOS Safari from zooming in on input focus
            e.currentTarget.style.fontSize = '16px'
          }}
        />

        <Flex justify="end" align="flex-end" p={3}>
          {isStreaming ? (
            <Icon
              as={FaCircleStop}
              fontSize="24px"
              color="red.500"
              cursor="pointer"
              onClick={cancelStream}
              _hover={{ color: 'red.600' }}
            />
          ) : (
            <Icon
              as={FaArrowCircleRight}
              fontSize="24px"
              color={
                input?.trim()
                  ? 'primary.500'
                  : 'interaction.support.disabled-content'
              }
              onClick={handleSubmit}
              cursor={input?.trim() ? 'pointer' : 'default'}
            />
          )}
        </Flex>
      </Flex>

      {shouldShowIdeas && (
        <IdeaButtons
          ideas={AI_CHAT_IDEAS}
          onClick={(idea: AiChatIdea) => {
            setInput(idea.input)
            // trigger resize after state update
            setTimeout(() => handleResize(), 0)
          }}
        />
      )}

      {!isMobile && (
        <Flex gap={1} alignItems="center" justify="center" mt={3}>
          <Text fontSize="xs" color="gray.500">
            Powered by{' '}
          </Text>
          <ImageBox imageUrl={pairLogo} boxSize={6} />
        </Flex>
      )}
    </Box>
  )
}
