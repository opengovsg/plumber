import {
  type FormEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import { Box, Flex, Icon, Textarea } from '@chakra-ui/react'

import { type ClarificationQuestion } from '@/hooks/useChatStream'
import ChoicePicker from '@/pages/AiBuilder/components/ChatInterface/ChoicePicker'
import IdeaButtons from '@/pages/AiBuilder/components/IdeaButtons'
import { AI_CHAT_IDEAS, type AiChatIdea } from '@/pages/AiBuilder/constants'

interface PromptInputProps {
  isStreaming: boolean
  showIdeas?: boolean
  placeholder?: string
  initialValue?: string
  sendMessage: (message: string) => void
  cancelStream: () => void
  clarification?: ClarificationQuestion[]
}

export default function PromptInput({
  isStreaming,
  showIdeas = false,
  placeholder = 'Send a message',
  initialValue = '',
  sendMessage,
  cancelStream,
  clarification,
}: PromptInputProps) {
  const [input, setInput] = useState<string>(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({})
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)

  // Reset state whenever a new clarification arrives
  useEffect(() => {
    setSelectedAnswers({})
    setCurrentQuestionIdx(0)
  }, [clarification])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (input?.trim() && !isStreaming) {
      sendMessage(input)
      setInput('')
      setSelectedAnswers({})
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
    const maxHeight = window.innerHeight * 0.4 - 100
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px'
  }

  // Trigger resize on mount if initialValue is pre-filled
  useEffect(() => {
    if (initialValue) {
      handleResize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnswer = (answer: string) => {
    if (isStreaming || !clarification) {
      return
    }

    const newAnswers = { ...selectedAnswers, [currentQuestionIdx]: answer }
    setSelectedAnswers(newAnswers)

    const isLast = currentQuestionIdx === clarification.length - 1
    if (isLast) {
      const combined = clarification
        .map((q, i) => `Q: ${q.question}\nA: ${newAnswers[i]}`)
        .join('\n\n')
      sendMessage(combined)
      setSelectedAnswers({})
      setCurrentQuestionIdx(0)
    } else {
      setCurrentQuestionIdx((prev) => prev + 1)
    }
  }

  const handleOptionClick = (optionIdx: number) => {
    if (!clarification) {
      return
    }
    handleAnswer(clarification[currentQuestionIdx].options[optionIdx])
  }

  // only show idea buttons if showIdeas is true and the user has not entered any text
  const shouldShowIdeas = showIdeas && !input?.trim()

  if (clarification && clarification.length > 0) {
    return (
      <ChoicePicker
        clarification={clarification}
        currentQuestionIdx={currentQuestionIdx}
        isStreaming={isStreaming}
        onOptionClick={handleOptionClick}
        onFreeTextSubmit={handleAnswer}
        cancelStream={cancelStream}
      />
    )
  }

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
      >
        <Textarea
          ref={textareaRef}
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
              as={FaArrowCircleUp}
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

      {showIdeas && (
        <Box minH={{ base: '200px', md: '60px' }} mt={6}>
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
        </Box>
      )}
    </Box>
  )
}
